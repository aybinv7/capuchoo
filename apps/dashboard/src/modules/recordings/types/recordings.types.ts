import type {
  RECORDING_LIMITS,
  RecordingDeviceFacts,
  RecordingPolicy,
  RecordingPolicyPatch,
  RecordingRuleScope,
} from "@capuchoo/core";
import type { DecodedChange } from "../lib/changeset";

export interface RecordingSession {
  id: string;
  session_key: string;
  device_uuid: string | null;
  device_id: string;
  platform: string;
  version_name: string;
  version_code: number | null;
  channel: string | null;
  start: string;
  mode: string;
  note: string | null;
  device: RecordingDeviceFacts | null;
  recorder: string | null;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  segment_count: number;
  event_count: number;
  size_bytes: number;
  error_count: number;
  finished: boolean;
  last_segment_at: string;
  live: boolean;
}

export interface RecordingSegment {
  seq: number;
  size_bytes: number;
  raw_bytes: number;
  events: number;
  errors: number;
  full_snapshot: boolean;
  started_at: string;
  ended_at: string;
}

export interface RecordingAsset {
  id: string;
  path: string;
  content_type: string;
  sha256: string;
  size_bytes: number;
}

export interface RecordingDetail {
  session: RecordingSession;
  segments: RecordingSegment[];
  assets: RecordingAsset[];
}

export interface RecordingPage {
  sessions: RecordingSession[];
  nextCursor: string | null;
}

export interface RecordingFilters {
  deviceId: string | null;
  version: string | null;
  errors: boolean;
  start: string | null;
}

export interface RecordingRule {
  id: string;
  scope: RecordingRuleScope;
  channel_id: string | null;
  device_uuid: string | null;
  policy: RecordingPolicyPatch;
  live_until: string | null;
  updated_at: string;
}

export interface RecordingRules {
  rules: RecordingRule[];
  defaults: RecordingPolicy;
  limits: typeof RECORDING_LIMITS;
}

interface LaneEntry {
  id: string;
  /** Wall-clock milliseconds. */
  t: number;
}

export interface ConsoleLaneEntry extends LaneEntry {
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  stack: string | null;
  source: string;
}

export interface NetworkLaneEntry extends LaneEntry {
  transport: string;
  method: string;
  url: string;
  status: number | null;
  duration: number;
  error: string | null;
  traceId: string | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  responseSize: number | null;
}

export interface DatabaseColumn {
  name: string;
  type: string;
  pk: number;
}

export interface DatabaseSnapshot {
  columns: string[];
  rows: unknown[][];
  /** When the snapshot was read; the table's state at that moment. */
  at: number;
  truncated: boolean;
}

export interface DatabaseLaneEntry extends LaneEntry {
  db: string;
  kind: "changeset" | "rows" | "change";
  changes: DecodedChange[];
  table: string | null;
  type: string | null;
  rows: number | null;
  error: string | null;
}

export interface TelemetryLaneEntry extends LaneEntry {
  kind: string;
  name: string;
  duration: number | null;
  data: Record<string, unknown> | null;
  message: string | null;
}

export interface PerfLaneEntry extends LaneEntry {
  kind: string;
  value: number | null;
  duration: number | null;
  name: string | null;
}

export interface MarkerLaneEntry extends LaneEntry {
  kind: string;
  label: string;
  data: Record<string, unknown>;
}

export interface Lanes {
  replay: Array<{ type: number; timestamp: number; data: unknown }>;
  console: ConsoleLaneEntry[];
  network: NetworkLaneEntry[];
  database: DatabaseLaneEntry[];
  telemetry: TelemetryLaneEntry[];
  perf: PerfLaneEntry[];
  markers: MarkerLaneEntry[];
  /** Table name to columns, per database, from the schema each source announced. */
  schemas: Record<string, Record<string, DatabaseColumn[]>>;
  /** Starting state per database and table, assembled from snapshot chunks. */
  snapshots: Record<string, Record<string, DatabaseSnapshot>>;
}

export type LaneName = "console" | "network" | "database" | "telemetry" | "perf" | "markers";
