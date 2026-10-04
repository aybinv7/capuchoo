import { effectiveRole } from "@capuchoo/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { keyAppRestriction, keyRoleCap } from "../../auth/principal";
import { listAccessibleApps } from "../../repositories/apps";
import { findBundle, findNativeBuild } from "../../repositories/artefacts";
import { listChannels } from "../../repositories/channels";
import { appStats } from "../../services/app-stats";
import { recordingStats } from "../../services/recording-summary";
import { appArg } from "../args";
import { attentionOf } from "../attention";
import { appAccess, guarded, iso, type ToolContext } from "../context";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

export function registerAppTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "list_apps",
    {
      title: "List apps",
      description:
        "The apps this key can reach, with the role it acts with on each. Start here to get an app's id.",
      inputSchema: {},
      annotations: READ,
    },
    guarded(ctx, "list_apps", async () => {
      const restricted = keyAppRestriction(ctx.principal);
      const cap = keyRoleCap(ctx.principal);
      const apps = await listAccessibleApps(
        ctx.deps.db,
        ctx.principal.userId,
        ctx.principal.isInstanceAdmin,
      );
      return {
        apps: apps
          .filter((app) => !restricted || app.id === restricted)
          .map((app) => ({
            id: app.id,
            name: app.name,
            bundle_id: app.app_id,
            role: effectiveRole(app.role, cap),
          })),
      };
    }),
  );

  server.registerTool(
    "app_overview",
    {
      title: "App overview",
      description:
        "How an app ships and how it behaves on devices: install success and failures, sessions and errors, each channel with the release it serves and its health, and what needs attention first (regressions, a release that breaks more than the last, failing channels, recorders in trouble).",
      inputSchema: {
        app: appArg,
        days: z
          .number()
          .int()
          .min(1)
          .max(14)
          .default(7)
          .describe("The window, in days (recordings are kept 14)."),
      },
      annotations: READ,
    },
    guarded(ctx, "app_overview", async ({ app, days }: { app: string; days: number }) => {
      const access = await appAccess(ctx, app, "viewer", "Reading the app");
      const appId = access.app.id;
      const [delivery, recording, channels] = await Promise.all([
        appStats(ctx.deps, appId, days),
        recordingStats(ctx.deps, appId, days),
        listChannels(ctx.deps.db, appId),
      ]);
      const versions = await Promise.all(
        channels.map(async (channel) => ({
          bundle: channel.current_bundle_id
            ? await findBundle(ctx.deps.db, channel.current_bundle_id)
            : null,
          native: channel.current_native_id
            ? await findNativeBuild(ctx.deps.db, channel.current_native_id)
            : null,
        })),
      );
      const health = new Map(delivery.channels.map((row) => [row.channel_id, row]));
      return {
        app: {
          id: appId,
          name: access.app.name,
          bundle_id: access.app.app_id,
          your_role: access.role,
        },
        days,
        needs_attention: attentionOf(delivery, recording),
        delivery: delivery.totals,
        sessions: {
          ...recording.totals,
          issues: {
            open: recording.issues.open,
            regressed: recording.issues.regressed,
            new: recording.issues.new,
          },
          top_errors: recording.issues.top.map((issue) => ({
            id: issue.id,
            message: issue.message,
            status: issue.status,
            sessions: issue.sessions,
            devices: issue.devices,
            last_seen: issue.last_seen,
          })),
          recorders: recording.recorders,
        },
        channels: channels.map((channel, index) => {
          const row = health.get(channel.id);
          return {
            id: channel.id,
            name: channel.name,
            environment: channel.environment,
            kind: channel.kind,
            paused: channel.paused,
            ota: versions[index]?.bundle?.version_name ?? null,
            native: versions[index]?.native
              ? `${versions[index].native.version_name} (${versions[index].native.version_code})`
              : null,
            devices: row?.devices ?? 0,
            on_current: row?.on_current ?? 0,
            failures_24h: row?.failures_24h ?? 0,
            updated_at: iso(channel.updated_at),
          };
        }),
      };
    }),
  );
}
