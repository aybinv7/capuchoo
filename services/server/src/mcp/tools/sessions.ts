import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { notFound } from "../../lib/errors";
import { isUuid } from "../../repositories/apps";
import { findSession, listSessions } from "../../repositories/recording-sessions";
import { appArg, limitArg, uuidArg } from "../args";
import { appAccess, guarded, iso, resolveDevice, type ToolContext } from "../context";
import { buildTimeline, clock } from "../timeline/build-timeline";
import { readSessionLines } from "../timeline/read-lines";
import { symbolicate } from "../timeline/symbolicate";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
/** Distinct errors whose stacks are mapped back to source; the rest keep their message. */
const SYMBOLICATED_ERRORS = 3;

function cursorOf(raw: string | undefined) {
  if (!raw) return undefined;
  const [time, id] = raw.split("_");
  const startedAt = new Date(Number(time));
  return id && isUuid(id) && !Number.isNaN(startedAt.getTime()) ? { startedAt, id } : undefined;
}

const deviceLabel = (device: unknown, fallback: string) => {
  const facts = (device ?? {}) as { manufacturer?: unknown; model?: unknown };
  return (
    [facts.manufacturer, facts.model].filter((part) => typeof part === "string").join(" ") ||
    fallback
  );
};

export function registerSessionTools(server: McpServer, ctx: ToolContext) {
  const replayUrl = (appId: string, sessionId: string) =>
    ctx.deps.config.DASHBOARD_URL
      ? `${ctx.deps.config.DASHBOARD_URL.replace(/\/+$/, "")}/apps/${appId}/recordings/${sessionId}`
      : null;

  server.registerTool(
    "list_sessions",
    {
      title: "List recorded sessions",
      description:
        "Recorded sessions of an app, newest first: device, version, channel, what started them (error, shake, report, app, rule), length, error count and the user's note. Filter by device, version, errors or start; page with `cursor`.",
      inputSchema: {
        app: appArg,
        device: z
          .string()
          .max(200)
          .optional()
          .describe("Only this device (id, or the id it reports)."),
        version: z.string().max(50).optional().describe("Only this app version."),
        errors_only: z.boolean().default(false).describe("Only sessions that saw an error."),
        started_by: z.enum(["error", "shake", "manual", "app", "policy"]).optional(),
        limit: limitArg(20, 100),
        cursor: z.string().max(80).optional().describe("The `next_cursor` of the previous page."),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "list_sessions",
      async (args: {
        app: string;
        device?: string;
        version?: string;
        errors_only: boolean;
        started_by?: string;
        limit: number;
        cursor?: string;
      }) => {
        const access = await appAccess(ctx, args.app, "viewer", "Reading recordings");
        const deviceUuid = args.device
          ? (
              await resolveDevice(
                ctx,
                { app: access.app.id, device: args.device },
                "viewer",
                "Reading recordings",
              )
            ).device.id
          : undefined;
        const rows = await listSessions(ctx.deps.db, {
          appId: access.app.id,
          deviceUuid,
          version: args.version,
          withErrors: args.errors_only,
          start: args.started_by,
          before: cursorOf(args.cursor),
          limit: args.limit + 1,
        });
        const page = rows.slice(0, args.limit);
        const last = page.at(-1);
        return {
          sessions: page.map((session) => ({
            id: session.id,
            device: deviceLabel(session.device, session.device_id),
            device_id: session.device_uuid,
            version: session.version_name,
            channel: session.channel,
            started_by: session.start,
            started_at: iso(session.started_at),
            duration_s: Math.round(
              (session.ended_at.getTime() - session.started_at.getTime()) / 1000,
            ),
            errors: session.error_count,
            note: session.note,
          })),
          next_cursor:
            rows.length > args.limit && last ? `${last.started_at.getTime()}_${last.id}` : null,
        };
      },
    ),
  );

  server.registerTool(
    "session_timeline",
    {
      title: "Session timeline",
      description:
        "What happened in one recorded session, as a timeline a model can reason over: the user's taps and typing, routes, the app's warnings, requests (failed and slow ones flagged), database writes and errors, each at its offset from the start, with each error's stack (or, for an error logged without one, `logged_at`: the app code that logged it) mapped back to source through the uploaded source maps. With focus `errors` (the default) only the stretch around each error is kept. Query values are hidden and typed values in masked fields stay masked.",
      inputSchema: {
        session: uuidArg("session"),
        focus: z.enum(["errors", "all"]).default("errors"),
        before_s: z
          .number()
          .int()
          .min(0)
          .max(600)
          .default(30)
          .describe("Seconds kept before each error."),
        after_s: z
          .number()
          .int()
          .min(0)
          .max(120)
          .default(5)
          .describe("Seconds kept after each error."),
        max_items: z.number().int().min(10).max(500).default(150),
        source_maps: z.boolean().default(true).describe("Map error stacks back to source."),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "session_timeline",
      async (args: {
        session: string;
        focus: "errors" | "all";
        before_s: number;
        after_s: number;
        max_items: number;
        source_maps: boolean;
      }) => {
        const session = await findSession(ctx.deps.db, args.session);
        if (!session) throw notFound("Session");
        const access = await appAccess(ctx, session.app_id, "viewer", "Reading a recording");
        const start = session.started_at.getTime();
        const { lines, truncated } = await readSessionLines(ctx.deps, session.id);
        const timeline = buildTimeline(lines, start, session.ended_at.getTime(), {
          focus: args.focus,
          beforeMs: args.before_s * 1000,
          afterMs: args.after_s * 1000,
          maxItems: args.max_items,
        });
        const seen = new Set<string>();
        const errors = [];
        for (const error of timeline.errors) {
          const first = !seen.has(error.message);
          seen.add(error.message);
          const trace = error.stack ?? error.site;
          const key = error.stack ? "stack" : "logged_at";
          const mapped =
            first && args.source_maps && trace && seen.size <= SYMBOLICATED_ERRORS
              ? await symbolicate(ctx.deps, {
                  appId: access.app.id,
                  version: session.version_name,
                  stack: trace,
                })
              : null;
          errors.push({
            at: clock(error.at_ms),
            message: error.message,
            source: error.source,
            ...(mapped
              ? { [key]: mapped }
              : first && trace
                ? { [`${key}_raw`]: trace.split("\n").slice(0, 6) }
                : {}),
          });
        }
        return {
          session: {
            id: session.id,
            device: deviceLabel(session.device, session.device_id),
            device_id: session.device_uuid,
            version: session.version_name,
            channel: session.channel,
            started_by: session.start,
            note: session.note,
            started_at: iso(session.started_at),
            duration: clock(timeline.duration_ms),
            replay: replayUrl(access.app.id, session.id),
          },
          counts: timeline.counts,
          errors,
          timeline: timeline.items.map(
            (item) => `${clock(item.at_ms)} [${item.kind}] ${item.text}`,
          ),
          omitted: timeline.omitted,
          incomplete: truncated,
        };
      },
    ),
  );
}
