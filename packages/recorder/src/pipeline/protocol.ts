import type { RecordedEvent, RecordingMode, RecordingSessionMeta } from "@capuchoo/core";

export interface PipelineSettings {
  /** Server origin, no trailing slash and no `/api`. */
  endpoint: string;
  flushMs: number;
  liveFlushMs: number;
  bufferMaxMs: number;
  bufferMaxBytes: number;
  wifiOnly: boolean;
}

export interface AssetRequest {
  appId: string;
  versionName: string;
  urls: string[];
  known: string[];
}

export type PipelineCommand =
  | { type: "configure"; settings: PipelineSettings }
  | { type: "begin"; mode: RecordingMode; session: RecordingSessionMeta }
  | { type: "mode"; mode: RecordingMode; session: RecordingSessionMeta }
  | { type: "events"; events: RecordedEvent[] }
  | { type: "end" }
  | { type: "flush" }
  | { type: "network"; online: boolean; wifi: boolean | null }
  | { type: "assets"; request: AssetRequest };

export interface PipelineStatus {
  backend: "opfs" | "memory";
  queued: number;
  uploadedSegments: number;
  uploadedBytes: number;
  droppedSegments: number;
  lastError: string | null;
}

export type PipelineReport =
  | { type: "status"; status: PipelineStatus }
  | { type: "log"; level: "warn" | "error"; message: string };

/** The main thread's handle on a pipeline, wherever it runs. */
export interface PipelineClient {
  send(command: PipelineCommand): void;
  onReport(listener: (report: PipelineReport) => void): () => void;
  terminate(): void;
}
