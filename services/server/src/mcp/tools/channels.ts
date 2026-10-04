import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findBundle, findNativeBuild } from "../../repositories/artefacts";
import { channelHistory } from "../../repositories/channels";
import { channelHealth } from "../../repositories/device-events";
import { channelRollout } from "../../services/channel-rollout";
import { channelArg, optionalApp } from "../args";
import { guarded, iso, resolveChannel, type ToolContext } from "../context";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

export function registerChannelTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "channel_details",
    {
      title: "Channel details",
      description:
        "One channel: the web bundle and native build it serves, whether it is paused, how far its devices have moved to the current release (version mix, devices behind), installs and failures, and its recent history with who moved it and why.",
      inputSchema: {
        app: optionalApp,
        channel: channelArg,
        history: z.number().int().min(0).max(50).default(10).describe("How many history entries."),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "channel_details",
      async (args: { app?: string; channel: string; history: number }) => {
        const { access, channel } = await resolveChannel(ctx, args, "viewer", "Reading a channel");
        const now = ctx.deps.now();
        const [bundle, native, health, rollout, history] = await Promise.all([
          channel.current_bundle_id
            ? findBundle(ctx.deps.db, channel.current_bundle_id)
            : undefined,
          channel.current_native_id
            ? findNativeBuild(ctx.deps.db, channel.current_native_id)
            : undefined,
          channelHealth(ctx.deps.db, access.app.id, now),
          channelRollout(ctx.deps.db, channel, "UTC", now),
          args.history > 0 ? channelHistory(ctx.deps.db, channel.id, args.history) : [],
        ]);
        return {
          channel: {
            id: channel.id,
            name: channel.name,
            environment: channel.environment,
            kind: channel.kind,
            paused: channel.paused,
            allow_downgrade: channel.allow_downgrade,
          },
          serving: {
            ota: bundle
              ? {
                  id: bundle.id,
                  version: bundle.version_name,
                  flavour: bundle.flavour,
                  uploaded_at: iso(bundle.created_at),
                }
              : null,
            native: native
              ? {
                  id: native.id,
                  version: native.version_name,
                  version_code: native.version_code,
                  flavour: native.flavour,
                }
              : null,
          },
          health: health.find((row) => row.channel_id === channel.id) ?? null,
          rollout: {
            devices: rollout.devices,
            on_current: rollout.on_current,
            current: rollout.current,
            mix: rollout.mix,
            behind: rollout.behind,
          },
          history: history.map((entry) => ({
            action: entry.action,
            from: entry.from_version,
            to: entry.to_version,
            reason: entry.reason,
            by: entry.actor_email ?? (entry.actor_api_key_id ? "api key" : null),
            at: iso(entry.created_at),
          })),
        };
      },
    ),
  );
}
