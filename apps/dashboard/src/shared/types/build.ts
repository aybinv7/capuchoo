import type { Environment } from "@capuchoo/core";

export type BuildStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type BuildStepStatus = "running" | "succeeded" | "failed" | "skipped" | "info";

export interface Build {
  id: string;
  app_id: string;
  channel_id: string | null;
  channel_name: string | null;
  kind: "ota" | "native" | "pipeline";
  status: BuildStatus;
  version_name: string | null;
  version_code: number | null;
  flavour: Environment | null;
  source: "cli" | "gitlab" | "github" | "other";
  external_id: string | null;
  commit_sha: string | null;
  ref: string | null;
  pipeline_url: string | null;
  job_url: string | null;
  actor_user_id: string | null;
  actor_api_key_id: string | null;
  actor_email?: string | null;
  bundle_id: string | null;
  native_id: string | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface BuildEvent {
  id: string;
  build_id: string;
  step: string;
  status: BuildStepStatus;
  message: string | null;
  created_at: string;
}

/** `GET /api/builds/:id`. */
export interface BuildDetail extends Build {
  events: BuildEvent[];
}
