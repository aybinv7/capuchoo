import { parseRecorderHealth, type RecordingDeviceFacts } from "@capuchoo/core";
import type {
  RecorderCheckIn,
  RecordingAsset,
  RecordingDetail,
  RecordingRule,
  RecordingSegment,
  RecordingSession,
} from "../types/recordings.types";

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const opt = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export function normalizeSession(raw: unknown): RecordingSession | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    session_key: str(raw.session_key),
    device_uuid: opt(raw.device_uuid),
    device_id: str(raw.device_id),
    platform: str(raw.platform, "android"),
    version_name: str(raw.version_name, "builtin"),
    version_code: typeof raw.version_code === "number" ? raw.version_code : null,
    channel: opt(raw.channel),
    start: str(raw.start, "policy"),
    mode: str(raw.mode, "session"),
    note: opt(raw.note),
    device: isRecord(raw.device) ? (raw.device as unknown as RecordingDeviceFacts) : null,
    recorder: opt(raw.recorder),
    started_at: str(raw.started_at),
    ended_at: str(raw.ended_at),
    duration_ms: num(raw.duration_ms),
    segment_count: num(raw.segment_count),
    event_count: num(raw.event_count),
    size_bytes: num(raw.size_bytes),
    error_count: num(raw.error_count),
    finished: raw.finished === true,
    last_segment_at: str(raw.last_segment_at),
    live: raw.live === true,
  };
}

function normalizeSegment(raw: unknown): RecordingSegment | null {
  if (!isRecord(raw) || typeof raw.seq !== "number") return null;
  return {
    seq: raw.seq,
    size_bytes: num(raw.size_bytes),
    raw_bytes: num(raw.raw_bytes),
    events: num(raw.events),
    errors: num(raw.errors),
    full_snapshot: raw.full_snapshot === true,
    started_at: str(raw.started_at),
    ended_at: str(raw.ended_at),
  };
}

function normalizeAsset(raw: unknown): RecordingAsset | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.path !== "string") return null;
  return {
    id: raw.id,
    path: raw.path,
    content_type: str(raw.content_type, "application/octet-stream"),
    sha256: str(raw.sha256),
    size_bytes: num(raw.size_bytes),
  };
}

export function normalizeDetail(raw: unknown): RecordingDetail | null {
  if (!isRecord(raw)) return null;
  const session = normalizeSession(raw.session);
  if (!session) return null;
  const list = <T>(value: unknown, map: (item: unknown) => T | null): T[] =>
    Array.isArray(value) ? value.map(map).filter((item): item is T => item !== null) : [];
  return {
    session,
    segments: list(raw.segments, normalizeSegment).sort((a, b) => a.seq - b.seq),
    assets: list(raw.assets, normalizeAsset),
  };
}

export function normalizeRule(raw: unknown): RecordingRule | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const scope = raw.scope === "channel" || raw.scope === "device" ? raw.scope : "app";
  return {
    id: raw.id,
    scope,
    channel_id: opt(raw.channel_id),
    device_uuid: opt(raw.device_uuid),
    policy: isRecord(raw.policy) ? raw.policy : {},
    live_until: opt(raw.live_until),
    updated_at: str(raw.updated_at),
  };
}

export function normalizeCheckIn(raw: unknown): RecorderCheckIn | null {
  if (!isRecord(raw) || typeof raw.device_id !== "string") return null;
  return {
    device_id: raw.device_id,
    device_uuid: opt(raw.device_uuid),
    custom_id: opt(raw.custom_id),
    model: opt(raw.model),
    manufacturer: opt(raw.manufacturer),
    platform: str(raw.platform, "android"),
    version_name: str(raw.version_name, "builtin"),
    channel: opt(raw.channel),
    health: parseRecorderHealth(raw.health),
    seen_at: str(raw.seen_at),
    online: raw.online === true,
  };
}
