import { classifyUpdateEvent } from "@capuchoo/core";
import type { Deps } from "../http/context";
import { findAppByBundleId } from "../repositories/apps";
import { listChannels } from "../repositories/channels";
import { insertDeviceEvents, type NewDeviceEvent } from "../repositories/device-events";
import { upsertDevice } from "../repositories/devices";
import { parseDeviceRequest, requestedChannel } from "./device-request";
import { publishDevice } from "./live-events";

export const MAX_BATCH = 100;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 255) : undefined;
}

function integer(value: unknown): number | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) ? parsed : undefined;
}

interface Normalised {
  bundleId: string;
  event: NewDeviceEvent;
  device: NonNullable<ReturnType<typeof parseDeviceRequest>>;
}

function normalise(raw: unknown, native: boolean): Normalised | null {
  const device = parseDeviceRequest(raw);
  if (!device) return null;
  const body = raw as Record<string, unknown>;
  const action = text(body.event) ?? text(body.action) ?? text(body.status);
  if (!action) return null;
  const versionCodeTo = integer(body.new_version_code);
  return {
    bundleId: device.appId,
    device,
    event: {
      appId: "",
      deviceUuid: null,
      channelId: null,
      kind: native || versionCodeTo !== undefined ? "native" : "ota",
      action,
      status: classifyUpdateEvent(action),
      versionFrom:
        text(body.old_version_name) ??
        text(body.current_version) ??
        (native ? String(integer(body.current_version_code) ?? "") || undefined : undefined),
      versionTo: text(body.new_version) ?? text(body.version_name) ?? text(body.version),
      versionCodeTo,
      error: text(body.error) ?? text(body.error_message),
    },
  };
}

/**
 * Records plugin statistics and runtime update events. Unknown apps are dropped silently: a device
 * must never learn which bundle ids exist, and a misconfigured build must not be able to 400-loop.
 */
export async function recordEvents(
  deps: Deps,
  body: unknown,
  options: { native: boolean },
): Promise<{ received: number; stored: number }> {
  const items = Array.isArray(body) ? body.slice(0, MAX_BATCH) : [body];
  const normalised = items
    .map((item) => normalise(item, options.native))
    .filter((item): item is Normalised => item !== null);

  const now = deps.now();
  const events: NewDeviceEvent[] = [];
  const devices: string[] = [];
  for (const item of normalised) {
    const identity = await deps.cache.get("identity", item.bundleId, () =>
      findAppByBundleId(deps.db, item.bundleId),
    );
    if (!identity) continue;
    const channels = await deps.cache.get(`app:${identity.app.id}`, "channels", () =>
      listChannels(deps.db, identity.app.id),
    );
    const reported = requestedChannel(item.device);
    const device = await upsertDevice(
      deps.db,
      {
        appId: identity.app.id,
        deviceId: item.device.deviceId,
        platform: item.device.platform,
        versionOs: item.device.versionOs,
        pluginVersion: item.device.pluginVersion,
        isProd: item.device.isProd,
        isEmulator: item.device.isEmulator,
        reportedChannel: reported,
      },
      now,
    );
    const channelId =
      device.channel_id ?? channels.find((channel) => channel.name === reported)?.id ?? null;
    events.push({ ...item.event, appId: identity.app.id, deviceUuid: device.id, channelId });
    devices.push(device.device_id);
  }

  await insertDeviceEvents(deps.db, events);
  const at = now.toISOString();
  for (const [index, event] of events.entries()) {
    publishDevice(deps, event.appId, {
      device_uuid: event.deviceUuid ?? "",
      device_id: devices[index] ?? null,
      channel_id: event.channelId,
      event: event.action,
      status: event.status ?? null,
      version: event.versionTo ?? null,
      version_code: event.versionCodeTo ?? null,
      model: null,
      at,
    });
  }
  return { received: items.length, stored: events.length };
}
