import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listAudit } from "../../repositories/audit";
import { appStats } from "../../services/app-stats";
import { recordingStats } from "../../services/recording-summary";
import { appArg, limitArg } from "../args";
import { appAccess, guarded, iso, type ToolContext } from "../context";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

type View = "updates" | "sessions" | "both";

export function registerInsightTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "app_stats",
    {
      title: "App statistics",
      description:
        "Daily numbers over a window. `updates`: checks, installs, failures, running versions and each channel's health. `sessions`: sessions with and without errors, what started them, error rate by version, top errors and recorder health (recordings are kept 14 days).",
      inputSchema: {
        app: appArg,
        view: z.enum(["updates", "sessions", "both"]).default("both"),
        days: z.number().int().min(1).max(90).default(14),
      },
      annotations: READ,
    },
    guarded(ctx, "app_stats", async (args: { app: string; view: View; days: number }) => {
      const access = await appAccess(ctx, args.app, "viewer", "Reading statistics");
      const [updates, sessions] = await Promise.all([
        args.view !== "sessions" ? appStats(ctx.deps, access.app.id, args.days) : null,
        args.view !== "updates"
          ? recordingStats(ctx.deps, access.app.id, Math.min(args.days, 14))
          : null,
      ]);
      return { updates, sessions };
    }),
  );

  server.registerTool(
    "audit_log",
    {
      title: "Audit log",
      description:
        "Who changed what in an app, newest first: deliveries, rollbacks, pauses, recording rules, Assist sessions, deletions, with the actor, key and details. Needs the admin role. Page with `before`.",
      inputSchema: {
        app: appArg,
        limit: limitArg(30, 200),
        before: z
          .string()
          .regex(/^\d+$/)
          .optional()
          .describe("The `next_before` of the previous page."),
      },
      annotations: READ,
    },
    guarded(ctx, "audit_log", async (args: { app: string; limit: number; before?: string }) => {
      const access = await appAccess(ctx, args.app, "admin", "Reading the audit log");
      const rows = await listAudit(ctx.deps.db, {
        appId: access.app.id,
        limit: args.limit,
        before: args.before,
      });
      return {
        entries: rows.map((row) => ({
          id: String(row.id),
          at: iso(row.created_at),
          action: row.action,
          target: row.target_type,
          target_id: row.target_id,
          by: row.actor_email ?? null,
          by_api_key: row.actor_api_key_id ? true : undefined,
          details: row.details,
        })),
        next_before: rows.length === args.limit ? String(rows.at(-1)?.id) : null,
      };
    }),
  );
}
