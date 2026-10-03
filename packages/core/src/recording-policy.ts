/**
 * What a device records, decided on the server from layered rules and sent to the recorder. The
 * server stores patches per app, channel and device; `resolveRecordingPolicy` folds them over the
 * defaults. App code may raise the mode at runtime, never above `ceiling`.
 */
import { fnv1a } from "./hash.js";

export const RECORDING_MODES = ["off", "buffer", "session", "live"] as const;
export type RecordingMode = (typeof RECORDING_MODES)[number];

export const RECORDING_TRACKS = [
  "replay",
  "console",
  "network",
  "perf",
  "telemetry",
  "database",
] as const;
export type RecordingTrack = (typeof RECORDING_TRACKS)[number];

export const RECORDING_TRIGGERS = ["error", "shake", "manual", "app"] as const;
export type RecordingTrigger = (typeof RECORDING_TRIGGERS)[number];

export const RECORDING_RULE_SCOPES = ["app", "channel", "device"] as const;
export type RecordingRuleScope = (typeof RECORDING_RULE_SCOPES)[number];

export interface RecordingPolicy {
  /** What runs with no trigger and no app code involved. */
  mode: RecordingMode;
  /** The highest mode a trigger or the app may raise the recorder to. */
  ceiling: RecordingMode;
  /** Fraction of devices that run `mode`; the rest start at `off`. Triggers still apply. */
  sampleRate: number;
  tracks: Record<RecordingTrack, boolean>;
  triggers: RecordingTrigger[];
  network: { bodies: boolean; maxBodyBytes: number };
  /**
   * Tables whose committed writes are captured, and how many rows of each are read as the starting
   * state when a session that uploads begins. `0` skips the starting state.
   */
  database: { tables: string[] | "all"; snapshotRows: number };
  /** Ring buffer kept on the device in `buffer` mode. */
  buffer: { maxMs: number; maxBytes: number };
  /** How long a session started by a trigger keeps uploading. */
  postRollMs: number;
  maxSessionMs: number;
  flushMs: number;
  liveFlushMs: number;
  wifiOnly: boolean;
  /** How often the device asks for its policy again. */
  pollMs: number;
  /**
   * While the app is in the foreground the device keeps one policy request open this long, and the
   * server answers it the moment a rule changes. `0` falls back to polling every `pollMs`.
   */
  listenMs: number;
}

export interface ResolvedRecordingPolicy extends RecordingPolicy {
  /** Changes whenever any field does; the device sends it back to skip an unchanged response. */
  version: string;
  liveUntil: number | null;
  sampled: boolean;
}

export type RecordingPolicyPatch = Partial<
  Omit<RecordingPolicy, "tracks" | "network" | "database" | "buffer">
> & {
  tracks?: Partial<Record<RecordingTrack, boolean>>;
  network?: Partial<RecordingPolicy["network"]>;
  database?: Partial<RecordingPolicy["database"]>;
  buffer?: Partial<RecordingPolicy["buffer"]>;
};

export interface RecordingRuleLayer {
  scope: RecordingRuleScope;
  patch: RecordingPolicyPatch;
  /** Epoch milliseconds; until then the device records live. */
  liveUntil?: number | null;
}

const MINUTE = 60_000;

export const RECORDING_LIMITS = {
  bufferMs: { min: 10_000, max: 30 * MINUTE },
  bufferBytes: { min: 256 * 1024, max: 64 * 1024 * 1024 },
  postRollMs: { min: 0, max: 15 * MINUTE },
  maxSessionMs: { min: MINUTE, max: 120 * MINUTE },
  flushMs: { min: 1000, max: 60_000 },
  liveFlushMs: { min: 250, max: 5000 },
  pollMs: { min: 15_000, max: 60 * MINUTE },
  listenMs: { min: 10_000, max: 55_000 },
  maxBodyBytes: { min: 0, max: 1024 * 1024 },
  tables: 200,
  tableName: 128,
  snapshotRows: { min: 0, max: 20_000 },
  liveMinutes: { min: 1, max: 120 },
} as const;

export const DEFAULT_RECORDING_POLICY: Readonly<RecordingPolicy> = Object.freeze<RecordingPolicy>({
  mode: "off",
  ceiling: "session",
  sampleRate: 1,
  tracks: {
    replay: true,
    console: true,
    network: true,
    perf: true,
    telemetry: true,
    database: true,
  },
  triggers: ["error", "shake", "manual", "app"],
  network: { bodies: false, maxBodyBytes: 64 * 1024 },
  database: { tables: "all", snapshotRows: 2000 },
  buffer: { maxMs: 5 * MINUTE, maxBytes: 8 * 1024 * 1024 },
  postRollMs: 2 * MINUTE,
  maxSessionMs: 30 * MINUTE,
  flushMs: 5000,
  liveFlushMs: 1000,
  wifiOnly: false,
  pollMs: 5 * MINUTE,
  listenMs: 50_000,
});

const SCOPE_ORDER: Record<RecordingRuleScope, number> = { app: 0, channel: 1, device: 2 };

export function modeRank(mode: RecordingMode): number {
  return RECORDING_MODES.indexOf(mode);
}

export function isRecordingMode(value: unknown): value is RecordingMode {
  return typeof value === "string" && (RECORDING_MODES as readonly string[]).includes(value);
}

/** The mode to switch to when something asks for `requested`: never lower than now, never above the ceiling. */
export function escalateMode(
  current: RecordingMode,
  requested: RecordingMode,
  ceiling: RecordingMode,
): RecordingMode {
  const target = Math.min(modeRank(requested), modeRank(ceiling));
  return target > modeRank(current) ? (RECORDING_MODES[target] ?? current) : current;
}

/** A stable bucket in [0, 1) per device, so sampling picks the same devices every time. */
export function deviceSampleBucket(deviceId: string): number {
  return fnv1a(deviceId) / 0x1_0000_0000;
}

function applyPatch(base: RecordingPolicy, patch: RecordingPolicyPatch): RecordingPolicy {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(
        ([key, value]) =>
          value !== undefined && !["tracks", "network", "database", "buffer"].includes(key),
      ),
    ),
    tracks: { ...base.tracks, ...patch.tracks },
    network: { ...base.network, ...patch.network },
    database: { ...base.database, ...patch.database },
    buffer: { ...base.buffer, ...patch.buffer },
  } as RecordingPolicy;
}

export interface ResolveRecordingContext {
  deviceId: string;
  now: number;
}

export function resolveRecordingPolicy(
  layers: readonly RecordingRuleLayer[],
  context: ResolveRecordingContext,
): ResolvedRecordingPolicy {
  const ordered = [...layers].sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]);
  let policy: RecordingPolicy = applyPatch(DEFAULT_RECORDING_POLICY, {});
  let liveUntil: number | null = null;

  for (const layer of ordered) {
    policy = applyPatch(policy, normaliseRecordingPatch(layer.patch).patch);
    if (typeof layer.liveUntil === "number" && layer.liveUntil > context.now) {
      liveUntil = Math.max(liveUntil ?? 0, layer.liveUntil);
    }
  }

  if (modeRank(policy.mode) > modeRank(policy.ceiling)) policy.mode = policy.ceiling;

  const targeted = ordered.some((layer) => layer.scope === "device");
  const sampled = targeted || deviceSampleBucket(context.deviceId) < policy.sampleRate;
  if (!sampled) policy.mode = "off";

  if (liveUntil !== null) {
    policy.mode = "live";
    policy.ceiling = "live";
  }

  const body = { ...policy, liveUntil, sampled };
  return { ...body, version: fnv1a(JSON.stringify(body)).toString(36) };
}

function clamp(value: unknown, range: { min: number; max: number }): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function prune<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

const TABLE = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export interface NormalisedRecordingPatch {
  patch: RecordingPolicyPatch;
  /** Fields refused, so the dashboard can say what it got wrong. */
  dropped: string[];
}

/** The storable subset of an untrusted patch: unknown keys dropped, numbers clamped to the limits. */
export function normaliseRecordingPatch(input: unknown): NormalisedRecordingPatch {
  const dropped: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { patch: {}, dropped };
  const raw = input as Record<string, unknown>;
  const patch: RecordingPolicyPatch = {};
  const limits = RECORDING_LIMITS;

  const take = <K extends keyof RecordingPolicyPatch>(
    key: K,
    value: RecordingPolicyPatch[K] | undefined,
  ) => {
    if (raw[key] === undefined) return;
    if (value === undefined) dropped.push(key);
    else patch[key] = value;
  };

  take("mode", isRecordingMode(raw.mode) ? raw.mode : undefined);
  take("ceiling", isRecordingMode(raw.ceiling) ? raw.ceiling : undefined);
  take(
    "sampleRate",
    typeof raw.sampleRate === "number" && Number.isFinite(raw.sampleRate)
      ? Math.min(1, Math.max(0, raw.sampleRate))
      : undefined,
  );
  take(
    "triggers",
    Array.isArray(raw.triggers)
      ? RECORDING_TRIGGERS.filter((trigger) => (raw.triggers as unknown[]).includes(trigger))
      : undefined,
  );
  take("postRollMs", clamp(raw.postRollMs, limits.postRollMs));
  take("maxSessionMs", clamp(raw.maxSessionMs, limits.maxSessionMs));
  take("flushMs", clamp(raw.flushMs, limits.flushMs));
  take("liveFlushMs", clamp(raw.liveFlushMs, limits.liveFlushMs));
  take("pollMs", clamp(raw.pollMs, limits.pollMs));
  take("listenMs", raw.listenMs === 0 ? 0 : clamp(raw.listenMs, limits.listenMs));
  take("wifiOnly", bool(raw.wifiOnly));

  if (raw.tracks !== undefined) {
    if (raw.tracks && typeof raw.tracks === "object" && !Array.isArray(raw.tracks)) {
      const tracks = raw.tracks as Record<string, unknown>;
      patch.tracks = prune(
        Object.fromEntries(RECORDING_TRACKS.map((track) => [track, bool(tracks[track])])),
      );
    } else dropped.push("tracks");
  }

  if (raw.network !== undefined) {
    const network = (raw.network ?? {}) as Record<string, unknown>;
    patch.network = prune({
      bodies: bool(network.bodies),
      maxBodyBytes: clamp(network.maxBodyBytes, limits.maxBodyBytes),
    });
  }

  if (raw.buffer !== undefined) {
    const buffer = (raw.buffer ?? {}) as Record<string, unknown>;
    patch.buffer = prune({
      maxMs: clamp(buffer.maxMs, limits.bufferMs),
      maxBytes: clamp(buffer.maxBytes, limits.bufferBytes),
    });
  }

  if (raw.database !== undefined) {
    const database = (raw.database ?? {}) as Record<string, unknown>;
    const next: RecordingPolicyPatch["database"] = {};
    const tables = database.tables;
    if (tables === "all") next.tables = "all";
    else if (Array.isArray(tables)) {
      const valid = tables.filter(
        (table): table is string =>
          typeof table === "string" && table.length <= limits.tableName && TABLE.test(table),
      );
      if (valid.length !== tables.length) dropped.push("database.tables");
      next.tables = [...new Set(valid)].slice(0, limits.tables);
    } else if (tables !== undefined) dropped.push("database.tables");
    const rows = clamp(database.snapshotRows, limits.snapshotRows);
    if (rows !== undefined) next.snapshotRows = rows;
    else if (database.snapshotRows !== undefined) dropped.push("database.snapshotRows");
    patch.database = next;
  }

  return { patch, dropped };
}
