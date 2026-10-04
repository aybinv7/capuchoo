import { RECORDING_LIMITS } from "@capuchoo/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { serializeRecordingRule } from "../../http/recording-serializers";
import { changeRecordingRule } from "../../services/recording-rule-change";
import { appArg, deviceArg, optionalApp } from "../args";
import { appAccess, guarded, resolveChannel, resolveDevice, type ToolContext } from "../context";

const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const VIA = { via: "mcp" } as const;

export function registerRecordingTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "set_recording_rule",
    {
      title: "Set what devices record",
      description:
        'Creates or changes the recording rule for the whole app, one channel or one device. `policy` is a partial policy merged over the defaults, for example {"mode":"buffer"}, {"mode":"session","sampleRate":0.2}, {"tracks":{"network":false}} or {"network":{"bodies":true}}; modes are off, buffer, session and live. Unknown fields are ignored, numbers are clamped to the limits, and a known field with an invalid value comes back in `dropped`. Needs the developer role.',
      inputSchema: {
        app: appArg,
        scope: z.enum(["app", "channel", "device"]),
        target: z
          .string()
          .max(200)
          .optional()
          .describe("The channel (id or name) or device (id or reported id) for those scopes."),
        policy: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Partial policy; leave out to keep the existing one."),
      },
      annotations: WRITE,
    },
    guarded(
      ctx,
      "set_recording_rule",
      async (args: {
        app: string;
        scope: "app" | "channel" | "device";
        target?: string;
        policy?: Record<string, unknown>;
      }) => {
        const access = await appAccess(ctx, args.app, "developer", "Changing what devices record");
        const channelId =
          args.scope === "channel"
            ? (
                await resolveChannel(
                  ctx,
                  { app: access.app.id, channel: args.target ?? "" },
                  "developer",
                  "Changing what devices record",
                )
              ).channel.id
            : undefined;
        const deviceId =
          args.scope === "device"
            ? (
                await resolveDevice(
                  ctx,
                  { app: access.app.id, device: args.target ?? "" },
                  "developer",
                  "Changing what devices record",
                )
              ).device.id
            : undefined;
        const { rule, dropped } = await changeRecordingRule(ctx.deps, {
          access,
          principal: ctx.principal,
          ip: ctx.ip,
          change: { scope: args.scope, channelId, deviceId, policy: args.policy },
          auditDetails: VIA,
        });
        return { rule: serializeRecordingRule(rule), dropped };
      },
    ),
  );

  server.registerTool(
    "go_live",
    {
      title: "Put a device live",
      description: `Makes one device stream its screen for a few minutes, so it can be watched as it is used and its sessions upload at once; 0 minutes ends it. The device picks it up within a second if the app is open. Needs the developer role.`,
      inputSchema: {
        app: optionalApp,
        device: deviceArg,
        minutes: z
          .number()
          .int()
          .min(0)
          .max(RECORDING_LIMITS.liveMinutes.max)
          .default(10)
          .describe(`How long, up to ${RECORDING_LIMITS.liveMinutes.max} minutes; 0 ends it.`),
      },
      annotations: WRITE,
    },
    guarded(ctx, "go_live", async (args: { app?: string; device: string; minutes: number }) => {
      const { access, device } = await resolveDevice(
        ctx,
        args,
        "developer",
        "Putting a device live",
      );
      const { rule } = await changeRecordingRule(ctx.deps, {
        access,
        principal: ctx.principal,
        ip: ctx.ip,
        change: {
          scope: "device",
          deviceId: device.id,
          liveMinutes: args.minutes === 0 ? null : args.minutes,
        },
        auditDetails: VIA,
      });
      return {
        device: device.custom_id ?? device.device_id,
        live_until: rule.live_until ? new Date(rule.live_until).toISOString() : null,
        watch: ctx.deps.config.DASHBOARD_URL
          ? `${ctx.deps.config.DASHBOARD_URL.replace(/\/+$/, "")}/apps/${access.app.id}/recordings?device=${device.id}`
          : null,
      };
    }),
  );
}
