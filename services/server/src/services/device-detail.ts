import type { Db } from "../db/database";
import type { Device } from "../db/schema";
import { listChannels } from "../repositories/channels";
import {
  deviceActivitySeries,
  deviceSummary,
  listDeviceEvents,
} from "../repositories/device-events";
import type { ActivityQuery } from "./event-range";

const SUMMARY_DAYS = 30;
const CATEGORIES = new Set([
  "check",
  "downloading",
  "delivered",
  "failed",
  "cancelled",
  "lifecycle",
  "other",
]);

export interface EventPageQuery {
  appId: string;
  from?: Date | undefined;
  to?: Date | undefined;
  deviceUuid?: string | undefined;
  channelId?: string | undefined;
  category?: string | undefined;
  before?: string | undefined;
  limit: number;
}

type EventRow = Awaited<ReturnType<typeof listDeviceEvents>>[number];

const memory = (value: Device["mem_used_bytes"]) => (value === null ? null : Number(value));

/** A device with its channels resolved and what it did over the last 30 days. */
export async function deviceDetail(db: Db, device: Device, now: Date, retentionDays: number) {
  const [channels, summary] = await Promise.all([
    listChannels(db, device.app_id),
    deviceSummary(db, device.id, new Date(now.getTime() - SUMMARY_DAYS * 86_400_000)),
  ]);
  const byId = (id: string | null) => channels.find((channel) => channel.id === id);
  const channel = byId(device.channel_id);
  const assigned = byId(device.assigned_channel_id);
  return {
    ...device,
    mem_used_bytes: memory(device.mem_used_bytes),
    channel: channel
      ? { id: channel.id, name: channel.name, environment: channel.environment }
      : null,
    assigned_channel: assigned ? { id: assigned.id, name: assigned.name } : null,
    summary: { days: SUMMARY_DAYS, ...summary },
    retention_days: retentionDays,
  };
}

/** A device's events counted per category and per local hour or day of the window. */
export async function deviceActivity(db: Db, device: Device, query: ActivityQuery) {
  const rows = await deviceActivitySeries(db, { deviceUuid: device.id, ...query });
  const totals: Record<string, number> = Object.fromEntries(
    [...CATEGORIES].map((category) => [category, 0]),
  );
  const buckets = new Map<string, Record<string, number | string>>();
  for (const row of rows) {
    const category = row.category && CATEGORIES.has(row.category) ? row.category : "other";
    const count = Number(row.count);
    totals[category] = (totals[category] ?? 0) + count;
    const bucket = buckets.get(row.at) ?? { at: row.at };
    bucket[category] = Number(bucket[category] ?? 0) + count;
    buckets.set(row.at, bucket);
  }
  return {
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    bucket: query.bucket,
    tz: query.tz,
    totals,
    series: [...buckets.values()],
  };
}

/** Rejects a category the classifier never produces instead of silently returning nothing. */
export function parseCategory(raw: string | undefined): string | undefined | null {
  if (!raw) return undefined;
  return CATEGORIES.has(raw) ? raw : null;
}

function eventOf(row: EventRow) {
  return {
    id: row.id,
    kind: row.kind,
    action: row.action,
    category: row.category,
    status: row.status,
    version_from: row.version_from,
    version_to: row.version_to,
    version_code_to: row.version_code_to,
    error: row.error,
    channel_id: row.channel_id,
    channel_name: row.channel_name,
    created_at: row.created_at,
  };
}

function deviceRefOf(row: EventRow) {
  if (!row.device_uuid || !row.device_id) return null;
  return {
    id: row.device_uuid,
    device_id: row.device_id,
    custom_id: row.custom_id,
    device_name: row.device_name,
    model: row.model,
    attributes: row.attributes,
  };
}

const nextCursor = (rows: EventRow[], limit: number) =>
  rows.length === limit ? (rows.at(-1)?.id ?? null) : null;

/** One device's timeline, newest first. */
export async function deviceEventPage(db: Db, query: EventPageQuery) {
  const rows = await listDeviceEvents(db, query);
  return { events: rows.map(eventOf), next: nextCursor(rows, query.limit) };
}

/** Every device's events for an app, newest first, each with the device it came from. */
export async function appActivityPage(db: Db, query: EventPageQuery) {
  const rows = await listDeviceEvents(db, query);
  return {
    events: rows.map((row) => ({ ...eventOf(row), device: deviceRefOf(row) })),
    next: nextCursor(rows, query.limit),
  };
}
