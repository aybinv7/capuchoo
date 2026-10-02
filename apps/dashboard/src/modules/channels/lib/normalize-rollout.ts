import { normalizeAttributes } from "@/shared/devices/lib/device-attributes";
import type {
  BehindDevice,
  ChannelRollout,
  CurvePoint,
  RolloutCurrent,
  VersionShare,
} from "../types/channel-insights.types";

type Row = Record<string, unknown>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;
const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : []);

function currentOf(value: unknown): RolloutCurrent | null {
  if (!isRow(value)) return null;
  const bundleId = text(value.bundle_id);
  const version = text(value.version);
  if (!bundleId || !version) return null;
  return {
    bundle_id: bundleId,
    version,
    delivered_at: text(value.delivered_at),
    delivered_by: text(value.delivered_by),
    from_version: text(value.from_version),
    rollback: value.rollback === true,
  };
}

function shareOf(row: Row): VersionShare | null {
  const version = text(row.version);
  return version ? { version, devices: count(row.devices), current: row.current === true } : null;
}

function behindOf(row: Row): BehindDevice | null {
  const id = text(row.id);
  if (!id) return null;
  return {
    id,
    device_id: text(row.device_id) ?? id,
    custom_id: text(row.custom_id),
    device_name: text(row.device_name),
    model: text(row.model),
    platform: text(row.platform),
    attributes: normalizeAttributes(row.attributes),
    version_name: text(row.version_name),
    last_seen_at: text(row.last_seen_at),
  };
}

function pointOf(row: Row): CurvePoint | null {
  const day = text(row.day);
  return day && DAY.test(day) ? { day, devices: count(row.devices) } : null;
}

const present = <T>(value: T | null): value is T => value !== null;

/**
 * `GET /api/channels/:id/rollout`, total over a partial body: unreadable rows are dropped, counts
 * are whole and never negative, and `on_current` never exceeds `devices`.
 */
export function normalizeRollout(value: unknown, asked: { tz: string }): ChannelRollout {
  const body = isRow(value) ? value : {};
  const devices = count(body.devices);
  return {
    current: currentOf(body.current),
    devices,
    on_current: Math.min(count(body.on_current), devices),
    mix: rows(body.mix).map(shareOf).filter(present),
    behind: rows(body.behind).map(behindOf).filter(present),
    curve: rows(body.curve)
      .map(pointOf)
      .filter(present)
      .sort((a, b) => a.day.localeCompare(b.day)),
    tz: text(body.tz) ?? asked.tz,
  };
}
