import type { AssistControl, AssistEndReason } from "@capuchoo/core";
import type { RecordingAsset } from "./recordings.types";

export interface AssistSessionInfo {
  id: string;
  app_id: string;
  device_uuid: string;
  status: "waiting" | "active" | "ended";
  control: AssistControl;
  agent: string;
  device_connected: boolean;
  created_at: string;
  invite_expires_at: string;
  ends_at: string;
}

export interface AssistStart {
  session: AssistSessionInfo;
  ticket: string;
  socket_url: string;
  assets: RecordingAsset[];
}

/**
 * Where the agent's side of a session stands: asking the server, waiting for the user to accept,
 * watching (with or without control), or over.
 */
export type AssistPhase = "starting" | "waiting" | "live" | "ended";

export interface AssistNotice {
  id: number;
  at: number;
  tone: "info" | "warning" | "danger";
  text: string;
}

export interface AssistOutcome {
  reason: AssistEndReason | "failed";
  message: string;
}
