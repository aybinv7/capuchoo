import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { notFound } from "../../lib/errors";
import {
  findIssue,
  issueSessions,
  listIssues,
  setIssueStatus,
} from "../../repositories/recording-issues";
import { normaliseIssueMessage } from "@capuchoo/core";
import { appArg, limitArg, uuidArg } from "../args";
import { appAccess, audit, guarded, iso, type ToolContext } from "../context";
import { readSessionLines } from "../timeline/read-lines";
import { symbolicate } from "../timeline/symbolicate";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

type Status = "unresolved" | "resolved" | "all";

const deviceLabel = (device: unknown, fallback: string) => {
  const facts = (device ?? {}) as { manufacturer?: unknown; model?: unknown };
  return (
    [facts.manufacturer, facts.model].filter((part) => typeof part === "string").join(" ") ||
    fallback
  );
};

interface RecordedTrace {
  /** The stack the error carried when thrown. */
  stack: string | null;
  /** Where the app logged an error that carried no stack. */
  site: string | null;
}

/** The error as one session recorded it, found by the message it groups under. */
async function traceFrom(
  ctx: ToolContext,
  sessionId: string,
  message: string,
): Promise<RecordedTrace | null> {
  const { lines } = await readSessionLines(ctx.deps, sessionId);
  for (const line of lines) {
    const data = (line.d ?? {}) as {
      text?: unknown;
      message?: unknown;
      stack?: unknown;
      site?: unknown;
    };
    const said =
      typeof data.text === "string"
        ? data.text
        : typeof data.message === "string"
          ? data.message
          : "";
    if (!said || normaliseIssueMessage(said) !== message) continue;
    const stack = typeof data.stack === "string" && data.stack ? data.stack : null;
    const site = typeof data.site === "string" && data.site ? data.site : null;
    if (stack || site) return { stack, site };
  }
  return null;
}

/** A recorded trace through the app's source maps, or its first raw lines when it cannot map. */
async function traceOutput(
  ctx: ToolContext,
  input: { appId: string; version: string; trace: RecordedTrace | null; sourceMaps: boolean },
) {
  const raw = input.trace?.stack ?? input.trace?.site;
  if (!raw) return {};
  const key = input.trace?.stack ? "stack" : "logged_at";
  const mapped = input.sourceMaps
    ? await symbolicate(ctx.deps, { appId: input.appId, version: input.version, stack: raw })
    : null;
  return { [key]: mapped ?? raw.split("\n").slice(0, 8) };
}

export function registerErrorTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "list_errors",
    {
      title: "List errors",
      description:
        "Errors devices recorded, grouped across sessions and versions, most recently seen first: message, top frame, status (open, regressed, resolved), how often, on how many sessions and devices, and the versions it spans.",
      inputSchema: {
        app: appArg,
        status: z.enum(["unresolved", "resolved", "all"]).default("unresolved"),
        limit: limitArg(20, 100),
      },
      annotations: READ,
    },
    guarded(ctx, "list_errors", async (args: { app: string; status: Status; limit: number }) => {
      const access = await appAccess(ctx, args.app, "viewer", "Reading errors");
      const rows = await listIssues(ctx.deps.db, access.app.id, {
        status: args.status,
        limit: args.limit,
      });
      return {
        errors: rows.map((row) => ({
          id: row.id,
          message: row.message,
          frame: row.frame,
          status: row.status,
          occurrences: Number(row.occurrences),
          sessions: Number(row.session_count),
          devices: Number(row.device_count),
          versions:
            row.first_version === row.last_version
              ? row.last_version
              : `${row.first_version} → ${row.last_version}`,
          first_seen: iso(row.first_seen),
          last_seen: iso(row.last_seen),
        })),
      };
    }),
  );

  server.registerTool(
    "error_details",
    {
      title: "Error details",
      description:
        "One grouped error: its message and status, the sessions it happened in (device, version, when, the user's note), and from its most recent occurrence the stack it was thrown with (`stack`), or for an error logged without one, the app code that logged it (`logged_at`), both mapped back to source. Follow up with `session_timeline` on a session to see what led to it.",
      inputSchema: {
        error: uuidArg("error"),
        sessions: z.number().int().min(1).max(50).default(10),
        source_maps: z.boolean().default(true).describe("Map the stack back to source."),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "error_details",
      async (args: { error: string; sessions: number; source_maps: boolean }) => {
        const issue = await findIssue(ctx.deps.db, args.error);
        if (!issue) throw notFound("Error");
        const access = await appAccess(ctx, issue.app_id, "viewer", "Reading an error");
        const sessions = await issueSessions(ctx.deps.db, issue.id, args.sessions);
        const latest = sessions[0];
        const trace = latest
          ? await traceOutput(ctx, {
              appId: access.app.id,
              version: latest.version_name,
              trace: await traceFrom(ctx, latest.id, issue.message),
              sourceMaps: args.source_maps,
            })
          : {};
        return {
          error: {
            id: issue.id,
            message: issue.message,
            frame: issue.frame,
            status: issue.status,
            occurrences: Number(issue.occurrences),
            first_version: issue.first_version,
            last_version: issue.last_version,
            first_seen: iso(issue.first_seen),
            last_seen: iso(issue.last_seen),
            resolved_at: iso(issue.resolved_at),
          },
          ...trace,
          sessions: sessions.map((session) => ({
            id: session.id,
            device: deviceLabel(session.device, session.device_id),
            version: session.version_name,
            started_by: session.start,
            note: session.note,
            happened_at: iso(session.first_at),
            offset_s: Math.round(
              (session.first_at.getTime() - session.started_at.getTime()) / 1000,
            ),
            occurrences: session.occurrences,
          })),
        };
      },
    ),
  );

  server.registerTool(
    "set_error_status",
    {
      title: "Resolve or reopen an error",
      description:
        "Marks a grouped error resolved, or reopens it. A resolved error that happens again comes back as regressed. Needs the developer role.",
      inputSchema: {
        error: uuidArg("error"),
        status: z.enum(["open", "resolved"]),
        note: z.string().max(300).optional().describe("Why, kept in the audit log."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guarded(
      ctx,
      "set_error_status",
      async (args: { error: string; status: "open" | "resolved"; note?: string }) => {
        const issue = await findIssue(ctx.deps.db, args.error);
        if (!issue) throw notFound("Error");
        const access = await appAccess(
          ctx,
          issue.app_id,
          "developer",
          "Changing an error's status",
        );
        if (issue.status !== args.status) {
          await setIssueStatus(ctx.deps.db, issue.id, args.status, ctx.deps.now());
          await audit(ctx, access, {
            action:
              args.status === "resolved" ? "recording_issue.resolve" : "recording_issue.reopen",
            targetType: "recording_issue",
            targetId: issue.id,
            details: { message: issue.message, note: args.note ?? null },
          });
        }
        return { id: issue.id, status: args.status, changed: issue.status !== args.status };
      },
    ),
  );
}
