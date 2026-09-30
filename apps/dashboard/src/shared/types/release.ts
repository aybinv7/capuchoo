import type { Environment } from "@capuchoo/core";

export type ChannelKind = "release" | "client";

/** A channel as the server serializes it (`serializeChannel`). */
export interface Channel {
  id: string;
  name: string;
  app_id: string;
  environment: Environment;
  kind: ChannelKind;
  base_channel_id: string | null;
  public: boolean;
  allow_device_self_set: boolean;
  allow_dev: boolean;
  allow_emulator: boolean;
  ios_enabled: boolean;
  android_enabled: boolean;
  paused: boolean;
  allow_downgrade: boolean;
  current_bundle_id: string | null;
  current_native_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Bundle {
  id: string;
  kind: "ota";
  app_id: string;
  platform: "android" | "ios" | "web";
  version_name: string;
  flavour: Environment | null;
  size_bytes: number;
  checksum: string;
  signed: boolean;
  min_native_version: number | null;
  required: boolean;
  release_notes: string | null;
  uploaded_by: string | null;
  build_id: string | null;
  created_at: string | null;
}

export interface NativeBuild {
  id: string;
  kind: "native";
  app_id: string;
  platform: "android" | "ios";
  version_name: string;
  version_code: number;
  flavour: Environment | null;
  size_bytes: number;
  checksum: string;
  signed: boolean;
  signing_cert_sha256: string | null;
  required: boolean;
  release_notes: string | null;
  min_sdk: number | null;
  uploaded_by: string | null;
  build_id: string | null;
  created_at: string | null;
}

export type Artefact = Bundle | NativeBuild;

/** `GET /api/apps/:id/artefacts`: everything needed to reason about delivery. */
export interface ReleaseCatalog {
  bundles: Bundle[];
  natives: NativeBuild[];
  channels: Channel[];
}

export interface ChannelHealth {
  channel_id: string;
  devices: number;
  active_24h: number;
  on_current: number;
  installs_24h: number;
  failures_24h: number;
  installs_7d: number;
  failures_7d: number;
}

/** `GET /api/channels/:id`. */
export interface ChannelDetail extends Channel {
  current_bundle: Bundle | null;
  current_native: NativeBuild | null;
  health: ChannelHealth | null;
}

export type ChannelAction =
  | "point_bundle"
  | "point_native"
  | "rollback_bundle"
  | "rollback_native"
  | "clear_bundle"
  | "clear_native"
  | "pause"
  | "resume";

/** One row of `GET /api/channels/:id/history`. */
export interface ChannelHistoryEntry {
  id: string;
  action: ChannelAction;
  from_id: string | null;
  to_id: string | null;
  from_version: string | null;
  to_version: string | null;
  reason: string | null;
  created_at: string;
  actor_api_key_id: string | null;
  actor_email: string | null;
}
