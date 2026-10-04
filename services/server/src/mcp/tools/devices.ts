import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listDevices } from "../../repositories/devices";
import { listSessions } from "../../repositories/recording-sessions";
import { deviceDetail, deviceEventPage } from "../../services/device-detail";
import { appArg, deviceArg, limitArg, optionalApp } from "../args";
import {
  appAccess,
  guarded,
  iso,
  resolveChannel,
  resolveDevice,
  type ToolContext,
} from "../context";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const DAY_MS = 86_400_000;

export function registerDeviceTools(server: McpServer, ctx: ToolContext) {
  server.registerTool(
    "find_devices",
    {
      title: "Find devices",
      description:
        "Devices of an app, searched by id, custom id, model, name or attributes, and filtered by channel, version, activity or being behind their channel's release. Paged with offset.",
      inputSchema: {
        app: appArg,
        query: z
          .string()
          .max(100)
          .optional()
          .describe("Matches id, custom id, model, name or attributes."),
        channel: z
          .string()
          .max(100)
          .optional()
          .describe("Only devices on this channel (id or name)."),
        version: z
          .string()
          .max(50)
          .optional()
          .describe('Only this web version; "builtin" for none applied.'),
        behind: z
          .boolean()
          .optional()
          .describe("Only devices not on their channel's current release."),
        active_days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .optional()
          .describe("Only devices seen in the last N days."),
        limit: limitArg(25, 100),
        offset: z.number().int().min(0).max(100_000).default(0),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "find_devices",
      async (args: {
        app: string;
        query?: string;
        channel?: string;
        version?: string;
        behind?: boolean;
        active_days?: number;
        limit: number;
        offset: number;
      }) => {
        const access = await appAccess(ctx, args.app, "viewer", "Reading devices");
        const channelId = args.channel
          ? (
              await resolveChannel(
                ctx,
                { app: access.app.id, channel: args.channel },
                "viewer",
                "Reading devices",
              )
            ).channel.id
          : undefined;
        const { rows, total } = await listDevices(ctx.deps.db, {
          appId: access.app.id,
          channelId,
          search: args.query,
          version: args.version,
          behind: args.behind,
          activeSince: args.active_days
            ? new Date(ctx.deps.now().getTime() - args.active_days * DAY_MS)
            : undefined,
          limit: args.limit,
          offset: args.offset,
        });
        return {
          total,
          next_offset: args.offset + rows.length < total ? args.offset + rows.length : null,
          devices: rows.map((device) => ({
            id: device.id,
            device_id: device.device_id,
            custom_id: device.custom_id,
            model: [device.manufacturer, device.model].filter(Boolean).join(" ") || null,
            channel: device.channel_name ?? null,
            version: device.version_name,
            native: device.version_builtin,
            os: device.version_os,
            last_seen: iso(device.last_seen_at),
          })),
        };
      },
    ),
  );

  server.registerTool(
    "device_details",
    {
      title: "Device details",
      description:
        "One device: hardware, channel, versions, its update history summary, recent update events, and its latest recorded sessions.",
      inputSchema: {
        app: optionalApp,
        device: deviceArg,
        events: z
          .number()
          .int()
          .min(0)
          .max(100)
          .default(15)
          .describe("How many recent update events."),
        sessions: z.number().int().min(0).max(20).default(5).describe("How many recent sessions."),
      },
      annotations: READ,
    },
    guarded(
      ctx,
      "device_details",
      async (args: { app?: string; device: string; events: number; sessions: number }) => {
        const { access, device } = await resolveDevice(ctx, args, "viewer", "Reading a device");
        const now = ctx.deps.now();
        const [detail, events, sessions] = await Promise.all([
          deviceDetail(ctx.deps.db, device, now, ctx.deps.config.DEVICE_EVENT_RETENTION_DAYS),
          args.events > 0
            ? deviceEventPage(ctx.deps.db, {
                appId: access.app.id,
                deviceUuid: device.id,
                limit: args.events,
              })
            : { events: [], next: null },
          args.sessions > 0
            ? listSessions(ctx.deps.db, {
                appId: access.app.id,
                deviceUuid: device.id,
                limit: args.sessions,
              })
            : [],
        ]);
        return {
          device: {
            id: detail.id,
            device_id: detail.device_id,
            custom_id: detail.custom_id,
            name: detail.device_name,
            model: [detail.manufacturer, detail.model].filter(Boolean).join(" ") || null,
            platform: detail.platform,
            os: detail.version_os,
            emulator: detail.is_emulator,
            version: detail.version_name,
            native: detail.version_builtin,
            native_code: detail.version_code,
            channel: detail.channel,
            assigned_channel: detail.assigned_channel,
            attributes: detail.attributes,
            last_seen: iso(detail.last_seen_at),
            first_seen: iso(detail.created_at),
          },
          updates: detail.summary,
          recent_events: events.events.map((event) => ({
            at: iso(event.created_at),
            kind: event.kind,
            action: event.action,
            status: event.status,
            from: event.version_from,
            to: event.version_to,
            error: event.error,
          })),
          recent_sessions: sessions.map((session) => ({
            id: session.id,
            started_at: iso(session.started_at),
            started_by: session.start,
            version: session.version_name,
            duration_s: Math.round(
              (session.ended_at.getTime() - session.started_at.getTime()) / 1000,
            ),
            errors: session.error_count,
            note: session.note,
          })),
        };
      },
    ),
  );
}
