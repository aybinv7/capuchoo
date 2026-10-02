import type { Environment, JobStatus, PipelinePlan, PipelineStep } from "@capuchoo/core";

export type { JobStatus, PipelinePlan, PipelineStep };

export type BuildStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type BuildStepStatus = "running" | "succeeded" | "failed" | "skipped" | "info";
export type BuildKind = "ota" | "native" | "pipeline";
export type BuildSource = "cli" | "gitlab" | "github" | "other";

export interface Build {
  id: string;
  app_id: string;
  channel_id: string | null;
  channel_name: string | null;
  kind: BuildKind;
  status: BuildStatus;
  version_name: string | null;
  version_code: number | null;
  flavour: Environment | null;
  source: BuildSource;
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
  /** The pipeline run this CLI deploy reported into. */
  parent_id: string | null;
  /** The run's job the deploy ran in, as the workflow names it. */
  job_key: string | null;
  run_attempt: number | null;
  workflow: string | null;
  title: string | null;
  /** push, pull_request, workflow_dispatch, tag, api, ... */
  trigger: string | null;
  /** Child deploys under a run, when the list endpoint counts them. */
  child_count?: number | null;
  /**
   * Channels the run's child deploys published to. The list endpoint sends it (empty for a plain
   * deploy); a stream row may leave it out, in which case the cached value is kept.
   */
  target_channel_ids?: string[];
  /** The same channels by name, for display. */
  target_channel_names?: string[];
}

export interface BuildEvent {
  id: string;
  build_id: string;
  step: string;
  status: BuildStepStatus;
  message: string | null;
  created_at: string;
}

/** One provider job of a pipeline run. */
export interface BuildJob {
  id: string;
  build_id: string;
  external_id: string;
  plan_key: string | null;
  name: string;
  stage: string | null;
  status: JobStatus;
  attempt: number;
  url: string | null;
  runner: string | null;
  steps: PipelineStep[];
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

/** A CLI deploy under a run, with the steps it reported. */
export interface BuildChild extends Build {
  events: BuildEvent[];
}

/** `GET /api/builds/:id`. */
export interface BuildDetail extends Build {
  events: BuildEvent[];
  jobs: BuildJob[];
  plan: PipelinePlan | null;
  children: BuildChild[];
}
