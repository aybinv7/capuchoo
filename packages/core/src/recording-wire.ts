/**
 * How a recording travels. A session is a run of gzip'd NDJSON segments, each posted as its own
 * request with the metadata in a header, so the server stores the body untouched and a dashboard
 * fetch gets it decompressed by the browser.
 */
import {
  RECORDING_TRIGGERS,
  isRecordingMode,
  type RecordingMode,
  type RecordingTrack,
  type RecordingTrigger,
} from "./recording-policy.js";

export const RECORDING_HEADER = "x-capuchoo-recording";
export const RECORDING_ASSET_HEADER = "x-capuchoo-asset";

export const RECORDING_WIRE_LIMITS = {
  segmentBytes: 2 * 1024 * 1024,
  assetBytes: 4 * 1024 * 1024,
  headerBytes: 8 * 1024,
  note: 1000,
  text: 255,
  path: 512,
} as const;

/** One NDJSON line. `t` is wall-clock milliseconds; `marker` and `meta` lines exist in every session. */
export type RecordedKind = RecordingTrack | "marker" | "meta";

export interface RecordedEvent<T = unknown> {
  k: RecordedKind;
  t: number;
  d: T;
}

export type RecordingStart = RecordingTrigger | "policy";

export interface RecordingDeviceFacts {
  model: string | null;
  manufacturer: string | null;
  osVersion: string | null;
  webview: string | null;
  screen: { width: number; height: number; dpr: number } | null;
}

export interface RecordingSessionMeta {
  sessionId: string;
  /** The bundle id the app runs as. */
  appId: string;
  deviceId: string;
  platform: "android" | "ios" | "web";
  versionName: string;
  versionCode: number | null;
  channel: string | null;
  start: RecordingStart;
  mode: RecordingMode;
  startedAt: number;
  recorder: string;
  device: RecordingDeviceFacts;
  note: string | null;
}

export interface RecordingSegmentMeta {
  sessionId: string;
  seq: number;
  startedAt: number;
  endedAt: number;
  events: number;
  /** Uncompressed size. */
  bytes: number;
  /** Whether a replay full snapshot is in this segment, so playback can start here. */
  fullSnapshot: boolean;
  errors: number;
  final: boolean;
}

export interface RecordingSegmentHeader {
  session: RecordingSessionMeta;
  segment: RecordingSegmentMeta;
}

export interface RecordingAssetHeader {
  appId: string;
  versionName: string;
  /** Path on the app origin, e.g. `/assets/index-4f2a.css`. */
  path: string;
  sha256: string;
  contentType: string;
}

/** Sent by the device to ask for its policy. */
export interface RecordingPolicyRequest {
  appId: string;
  deviceId: string;
  platform: "android" | "ios" | "web";
  versionName: string;
  versionCode: number | null;
  channel: string | null;
  /** The `version` the device already has; an unchanged policy comes back as `{ unchanged: true }`. */
  known: string | null;
  /** How the recorder on the device is doing, for the dashboard's integration check. */
  health: RecorderHealth | null;
}

export const DATABASE_CAPTURE_STATES = [
  "off",
  "waiting",
  "changesets",
  "rows",
  "changes",
  "unsupported",
  "unavailable",
  "failed",
] as const;
export type DatabaseCaptureState = (typeof DATABASE_CAPTURE_STATES)[number];

export interface DatabaseHealth {
  name: string;
  state: DatabaseCaptureState;
  detail: string | null;
}

/** A recorder's own account of itself: what it runs on, what it captures, and what went wrong. */
export interface RecorderHealth {
  recorder: string;
  mode: RecordingMode;
  /** The pipeline runs in a worker; without one, serialization and gzip share the app's thread. */
  threaded: boolean;
  /** Where segments wait for upload; null until the pipeline first reports. */
  storage: "opfs" | "memory" | null;
  databases: DatabaseHealth[];
  queued: number;
  uploadedSegments: number;
  droppedSegments: number;
  lastError: string | null;
}

const MAX_HEALTH_DATABASES = 8;

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ASSET_PATH = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/;

export function isRecordingSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID.test(value);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Headers are Latin-1; base64url of UTF-8 JSON carries a note in any script. */
export function encodeRecordingHeader(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeRecordingHeader(text: string | null | undefined): unknown {
  if (!text || text.length > RECORDING_WIRE_LIMITS.headerBytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(text)));
  } catch {
    return null;
  }
}

function str(value: unknown, max: number = RECORDING_WIRE_LIMITS.text): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function int(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function platform(value: unknown): RecordingSessionMeta["platform"] | null {
  return value === "android" || value === "ios" || value === "web" ? value : null;
}

function deviceFacts(input: unknown): RecordingDeviceFacts {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const screen = (raw.screen && typeof raw.screen === "object" ? raw.screen : null) as Record<
    string,
    unknown
  > | null;
  const width = int(screen?.width, 0, 100_000);
  const height = int(screen?.height, 0, 100_000);
  const dpr =
    typeof screen?.dpr === "number" && screen.dpr > 0 && screen.dpr < 10 ? screen.dpr : null;
  return {
    model: str(raw.model),
    manufacturer: str(raw.manufacturer),
    osVersion: str(raw.osVersion),
    webview: str(raw.webview),
    screen: width !== null && height !== null && dpr !== null ? { width, height, dpr } : null,
  };
}

function sessionMeta(input: unknown): RecordingSessionMeta | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const sessionId = isRecordingSessionId(raw.sessionId) ? raw.sessionId : null;
  const appId = str(raw.appId);
  const deviceId = str(raw.deviceId);
  const os = platform(raw.platform);
  const startedAt = int(raw.startedAt);
  const start =
    raw.start === "policy" || (RECORDING_TRIGGERS as readonly unknown[]).includes(raw.start)
      ? (raw.start as RecordingStart)
      : null;
  if (!sessionId || !appId || !deviceId || !os || startedAt === null || !start) return null;
  if (!isRecordingMode(raw.mode)) return null;
  return {
    sessionId,
    appId,
    deviceId,
    platform: os,
    versionName: str(raw.versionName) ?? "builtin",
    versionCode: int(raw.versionCode),
    channel: str(raw.channel),
    start,
    mode: raw.mode,
    startedAt,
    recorder: str(raw.recorder, 40) ?? "unknown",
    device: deviceFacts(raw.device),
    note: str(raw.note, RECORDING_WIRE_LIMITS.note),
  };
}

function segmentMeta(input: unknown, sessionId: string): RecordingSegmentMeta | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const seq = int(raw.seq, 0, 1_000_000);
  const startedAt = int(raw.startedAt);
  const endedAt = int(raw.endedAt);
  const events = int(raw.events, 0, 10_000_000);
  const bytes = int(raw.bytes, 0, 1024 * 1024 * 1024);
  const errors = int(raw.errors, 0, 10_000_000) ?? 0;
  if (raw.sessionId !== sessionId || seq === null || startedAt === null || endedAt === null) {
    return null;
  }
  if (endedAt < startedAt || events === null || bytes === null) return null;
  return {
    sessionId,
    seq,
    startedAt,
    endedAt,
    events,
    bytes,
    fullSnapshot: raw.fullSnapshot === true,
    errors,
    final: raw.final === true,
  };
}

export function parseRecordingSegmentHeader(
  text: string | null | undefined,
): RecordingSegmentHeader | null {
  const decoded = decodeRecordingHeader(text);
  if (!decoded || typeof decoded !== "object") return null;
  const raw = decoded as Record<string, unknown>;
  const session = sessionMeta(raw.session);
  if (!session) return null;
  const segment = segmentMeta(raw.segment, session.sessionId);
  return segment ? { session, segment } : null;
}

export function parseRecordingAssetHeader(
  text: string | null | undefined,
): RecordingAssetHeader | null {
  const decoded = decodeRecordingHeader(text);
  if (!decoded || typeof decoded !== "object") return null;
  const raw = decoded as Record<string, unknown>;
  const appId = str(raw.appId);
  const versionName = str(raw.versionName);
  const path = str(raw.path, RECORDING_WIRE_LIMITS.path);
  const sha256 = typeof raw.sha256 === "string" && SHA256.test(raw.sha256) ? raw.sha256 : null;
  const contentType = str(raw.contentType, 100);
  if (!appId || !versionName || !path || !ASSET_PATH.test(path) || !sha256 || !contentType) {
    return null;
  }
  return { appId, versionName, path, sha256, contentType };
}

export function parseRecordingPolicyRequest(input: unknown): RecordingPolicyRequest | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const appId = str(raw.appId);
  const deviceId = str(raw.deviceId);
  const os = platform(raw.platform);
  if (!appId || !deviceId || !os) return null;
  return {
    appId,
    deviceId,
    platform: os,
    versionName: str(raw.versionName) ?? "builtin",
    versionCode: int(raw.versionCode),
    channel: str(raw.channel),
    known: str(raw.known, 40),
    health: parseRecorderHealth(raw.health),
  };
}

export function parseRecorderHealth(input: unknown): RecorderHealth | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const recorder = str(raw.recorder, 40);
  if (!recorder || !isRecordingMode(raw.mode)) return null;
  const databases = Array.isArray(raw.databases)
    ? raw.databases.slice(0, MAX_HEALTH_DATABASES).flatMap((entry): DatabaseHealth[] => {
        if (!entry || typeof entry !== "object") return [];
        const db = entry as Record<string, unknown>;
        const name = str(db.name, 64);
        const state = DATABASE_CAPTURE_STATES.find((known) => known === db.state);
        return name && state ? [{ name, state, detail: str(db.detail) }] : [];
      })
    : [];
  return {
    recorder,
    mode: raw.mode,
    threaded: raw.threaded === true,
    storage: raw.storage === "opfs" || raw.storage === "memory" ? raw.storage : null,
    databases,
    queued: int(raw.queued) ?? 0,
    uploadedSegments: int(raw.uploadedSegments) ?? 0,
    droppedSegments: int(raw.droppedSegments) ?? 0,
    lastError: str(raw.lastError),
  };
}
