import type {
  RecordedKind,
  RecordingDeviceFacts,
  RecordingMode,
  RecordingTrack,
  RecordingTrigger,
} from "@capuchoo/core";
import type { DatabaseSource } from "../database/types.js";
import type { PipelineStatus } from "../pipeline/protocol.js";
import type { NetworkOptions } from "../tracks/network.js";
import type { ReplayOptions } from "../tracks/replay.js";
import type { ShakeOptions } from "../triggers/shake.js";
import type { RecorderTelemetry } from "../tracks/telemetry.js";

/** Who is recording: the same facts the updater sends with an update check. */
export interface RecorderIdentity {
  /** Server origin, e.g. `https://updates.example.com`; a trailing `/api` is tolerated. */
  apiUrl: string;
  /** The bundle id the app runs as. */
  appId: string;
  deviceId: string;
  platform: "android" | "ios" | "web";
  versionName: string;
  versionCode: number | null;
  channel: string | null;
  device?: Partial<RecordingDeviceFacts>;
}

export interface RecorderLogger {
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
}

export interface TrackContext {
  push(kind: RecordedKind, data: unknown, time?: number): void;
  logger: RecorderLogger;
}

export interface Track {
  readonly name: RecordingTrack;
  start(context: TrackContext): void | Promise<void>;
  stop(): void;
}

export interface RecorderOptions {
  identity: () => Promise<RecorderIdentity>;
  /** Builds the recorder worker. Without it, the pipeline runs on the main thread from memory. */
  worker?: () => Worker;
  replay?: ReplayOptions;
  network?: NetworkOptions;
  databases?: DatabaseSource[];
  shake?: boolean | ShakeOptions;
  /**
   * Called on a shake, after the recorder has raised itself to a session. Show a report sheet and
   * pass what the user typed to `recorder.report`.
   */
  onShake?: () => void;
  logger?: RecorderLogger;
}

export interface RecorderStatus {
  mode: RecordingMode;
  sessionId: string | null;
  policyVersion: string | null;
  pipeline: PipelineStatus | null;
  lastError: string | null;
}

export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Raises the recorder for a trigger, within the policy's ceiling and trigger list. */
  trigger(trigger: RecordingTrigger, options?: { note?: string }): void;
  /** Raises the recorder from app code for `durationMs` (the policy's post-roll by default). */
  escalate(mode: RecordingMode, options?: { durationMs?: number; reason?: string }): void;
  /** Attaches a note to the current session and makes sure it uploads. */
  report(options?: { note?: string }): void;
  mark(name: string, data?: Record<string, unknown>): void;
  refreshPolicy(): Promise<void>;
  readonly telemetry: RecorderTelemetry;
  readonly status: RecorderStatus;
  subscribe(listener: (status: RecorderStatus) => void): () => void;
}
