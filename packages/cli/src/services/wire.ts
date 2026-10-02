import type { CloudApp, CloudChannel, Environment, Platform } from "@capuchoo/core";

/** A channel as the server returns it, including the delivery-model fields of docs/SERVER.md. */
export interface ChannelRecord extends CloudChannel {
  kind?: "release" | "client";
  base_channel_id?: string | null;
  paused?: boolean;
  allow_downgrade?: boolean;
  current_bundle_id?: string | null;
  current_native_id?: string | null;
}

/** An app row, with the signing settings `PUT /api/apps/:id/signing` controls. */
export interface AppRecord extends CloudApp {
  require_signature?: boolean;
  /** Base64 SPKI, or null when no key was ever uploaded. */
  signing_public_key?: string | null;
}

interface ArtefactBase {
  id: string;
  version_name: string;
  platform: Platform;
  flavour: Environment | null;
  sha256?: string | null;
  signed?: boolean;
  created_at: string;
  /** Channels that have ever served this artefact. */
  channels?: string[];
  /** Channels this artefact may be pointed at now. */
  eligible_channels?: string[];
}

export interface BundleArtefact extends ArtefactBase {
  min_native_version?: number | null;
}

export interface NativeArtefact extends ArtefactBase {
  version_code: number;
  /** Lowercase hex SHA-256 of the APK signing certificate. */
  signing_cert_sha256?: string | null;
}

/** `GET /api/apps/:id/artefacts`. */
export interface AppArtefacts {
  bundles: BundleArtefact[];
  native_builds: NativeArtefact[];
}

/** One row of `GET /api/channels/:id/history`, newest first. */
export interface PointerMove {
  id: string;
  created_at: string;
  action: string;
  bundle_id?: string | null;
  native_id?: string | null;
  version_name?: string | null;
  version_code?: number | null;
  reason?: string | null;
  actor_email?: string | null;
}

export type BuildStepStatus = "running" | "succeeded" | "failed" | "skipped";

export type BuildStep =
  | "resolve"
  | "assets"
  | "web"
  | "native"
  | "sync"
  | "bundle"
  | "sign"
  | "upload";

/** The CI run a deploy happens inside, so the server attaches the build to that run's job. */
export interface BuildCiRun {
  provider: "github" | "gitlab";
  run_id: string;
  run_attempt: number | null;
  job: string;
}

/** `POST /api/apps/:id/builds`. */
export interface BuildStart {
  kind: "ota" | "native";
  channel: string;
  version: string;
  source: "gitlab" | "github" | "cli";
  commit: string | null;
  ref: string | null;
  pipeline_url: string | null;
  job_url?: string | null;
  ci?: BuildCiRun | null;
}

/** `POST /api/builds/:id/finish`. */
export interface BuildFinish {
  status: "succeeded" | "failed";
  bundle_id?: string;
  native_id?: string;
  error?: string;
}

/** What the upload endpoints answer with; only the id is relied on. */
export interface UploadedArtefact {
  id?: string;
  bundle_id?: string;
  native_id?: string;
}
