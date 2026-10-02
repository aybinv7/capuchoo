import type { Environment } from "@capuchoo/core";
import type {
  ActivityEvent,
  Device,
  DeviceDetail,
  DeviceEvent,
  DeviceRef,
  DeviceSummary,
  EventPage,
} from "../types/devices.types";
import { normalizeAttributes } from "./device-attributes";
import { toCategory } from "./event-filters";

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;
const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const optionalCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const ENVIRONMENTS = new Set<string>(["dev", "staging", "prod"]);
const KINDS = new Set<string>(["ota", "native", "check"]);

/** A devices-list row with its attributes made safe to render. */
export function normalizeDeviceRow(row: Device): Device {
  return {
    ...row,
    attributes: normalizeAttributes(row.attributes),
    attributes_updated_at: text(row.attributes_updated_at),
  };
}

function summaryOf(value: unknown): DeviceSummary | null {
  if (!isRow(value)) return null;
  const delivered = isRow(value.last_delivered) ? value.last_delivered : null;
  const failure = isRow(value.last_failure) ? value.last_failure : null;
  const deliveredAt = text(delivered?.at);
  const failureAt = text(failure?.at);
  return {
    days: count(value.days) || 30,
    checks: count(value.checks),
    delivered: count(value.delivered),
    failed: count(value.failed),
    last_delivered: deliveredAt ? { version: text(delivered?.version), at: deliveredAt } : null,
    last_failure: failureAt
      ? { action: text(failure?.action) ?? "failure", error: text(failure?.error), at: failureAt }
      : null,
  };
}

/** `GET /api/devices/:id`, total over a server that omits the detail-only fields. */
export function normalizeDeviceDetail(value: unknown): DeviceDetail | null {
  if (!isRow(value) || !text(value.id) || !text(value.device_id)) return null;
  const channel = isRow(value.channel) ? value.channel : null;
  const assigned = isRow(value.assigned_channel) ? value.assigned_channel : null;
  const channelId = text(channel?.id);
  const assignedId = text(assigned?.id);
  const environment = text(channel?.environment);
  return {
    ...normalizeDeviceRow(value as unknown as Device),
    channel:
      channelId && channel
        ? {
            id: channelId,
            name: text(channel.name) ?? channelId,
            environment:
              environment && ENVIRONMENTS.has(environment) ? (environment as Environment) : null,
          }
        : null,
    assigned_channel:
      assignedId && assigned ? { id: assignedId, name: text(assigned.name) ?? assignedId } : null,
    summary: summaryOf(value.summary),
  };
}

/** One event row; null when it has no id or time to place it by. */
export function normalizeDeviceEvent(value: unknown): DeviceEvent | null {
  if (!isRow(value)) return null;
  const id = typeof value.id === "number" ? String(value.id) : text(value.id);
  const createdAt = text(value.created_at);
  if (!id || !createdAt) return null;
  const kind = text(value.kind);
  return {
    id,
    kind: kind && KINDS.has(kind) ? (kind as DeviceEvent["kind"]) : "ota",
    action: text(value.action) ?? "unknown",
    category: toCategory(value.category),
    status: text(value.status),
    version_from: text(value.version_from),
    version_to: text(value.version_to),
    version_code_to: optionalCount(value.version_code_to),
    error: text(value.error),
    channel_id: text(value.channel_id),
    created_at: createdAt,
  };
}

function deviceRefOf(value: unknown): DeviceRef | null {
  if (!isRow(value)) return null;
  const id = text(value.id);
  if (!id) return null;
  return {
    id,
    custom_id: text(value.custom_id),
    device_name: text(value.device_name),
    model: text(value.model),
    attributes: normalizeAttributes(value.attributes),
  };
}

export function normalizeActivityEvent(value: unknown): ActivityEvent | null {
  const event = normalizeDeviceEvent(value);
  if (!event || !isRow(value)) return null;
  return { ...event, device: deviceRefOf(value.device) };
}

/** A cursor page with the rows that could not be read dropped. */
export function normalizeEventPage<E extends DeviceEvent>(
  value: unknown,
  normalize: (row: unknown) => E | null,
): EventPage<E> {
  if (!isRow(value)) return { events: [], next: null };
  const events = Array.isArray(value.events)
    ? value.events.map(normalize).filter((event): event is E => event !== null)
    : [];
  return { events, next: text(value.next) };
}
