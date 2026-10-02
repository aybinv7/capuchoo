import type { BuildStatus, JobStatus, PipelineStep } from "@capuchoo/core";

type Payload = Record<string, unknown>;

export const asRecord = (value: unknown): Payload =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Payload) : {};

export const asText = (value: unknown, max = 255): string | null =>
  typeof value === "string" && value
    ? value.slice(0, max)
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null;

export const asDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asInt = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

function conclusionStatus(conclusion: unknown): JobStatus {
  switch (conclusion) {
    case "success":
      return "succeeded";
    case "cancelled":
      return "cancelled";
    case "skipped":
    case "neutral":
      return "skipped";
    case "action_required":
      return "waiting";
    default:
      return "failed";
  }
}

/** A GitHub job or step status plus conclusion, as one of ours. */
export function githubJobStatus(status: unknown, conclusion: unknown): JobStatus {
  switch (status) {
    case "completed":
      return conclusionStatus(conclusion);
    case "in_progress":
      return "running";
    case "waiting":
      return "waiting";
    case "queued":
    case "requested":
    case "pending":
      return "queued";
    default:
      return "pending";
  }
}

/** A GitHub workflow run status plus conclusion, as one of ours. */
export function githubRunStatus(status: unknown, conclusion: unknown): BuildStatus {
  if (status === "completed") {
    if (conclusion === "success") return "succeeded";
    if (conclusion === "cancelled" || conclusion === "skipped") return "cancelled";
    return "failed";
  }
  if (status === "in_progress" || status === "waiting") return "running";
  return "queued";
}

/** `.github/workflows/x.yml@refs/heads/main` from a reusable or dynamic run, without the ref. */
export function workflowPath(value: unknown): string | null {
  const text = asText(value, 500);
  return text ? (text.split("@")[0] ?? null) : null;
}

export interface MappedRun {
  runId: string;
  attempt: number | null;
  status: BuildStatus;
  repositoryId: string | null;
  installationId: string | null;
  path: string | null;
  headSha: string | null;
  fields: {
    commit_sha: string | null;
    ref: string | null;
    pipeline_url: string | null;
    title: string | null;
    workflow: string | null;
    trigger: string | null;
    error: string | null;
    started_at: Date | null;
    finished_at: Date | null;
  };
}

export function mapWorkflowRun(
  run: Payload,
  repositoryId: string | null,
  installationId: string | null,
): MappedRun | null {
  const runId = asText(run.id, 32);
  if (!runId) return null;
  const status = githubRunStatus(run.status, run.conclusion);
  return {
    runId,
    attempt: asInt(run.run_attempt),
    status,
    repositoryId,
    installationId,
    path: workflowPath(run.path),
    headSha: asText(run.head_sha, 64),
    fields: {
      commit_sha: asText(run.head_sha, 64),
      ref: asText(run.head_branch),
      pipeline_url: asText(run.html_url, 2000),
      title: asText(run.display_title) ?? asText(run.name),
      workflow: asText(run.name),
      trigger: asText(run.event, 64),
      error: status === "failed" ? asText(run.conclusion, 2000) : null,
      started_at: asDate(run.run_started_at) ?? asDate(run.created_at),
      finished_at:
        status === "succeeded" || status === "failed" || status === "cancelled"
          ? asDate(run.updated_at)
          : null,
    },
  };
}

export interface MappedJob {
  jobId: string;
  runId: string;
  attempt: number;
  name: string;
  status: JobStatus;
  url: string | null;
  runner: string | null;
  steps: PipelineStep[];
  startedAt: Date | null;
  finishedAt: Date | null;
}

function mapSteps(value: unknown): PipelineStep[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((entry, index) => {
    const step = asRecord(entry);
    const name = asText(step.name);
    if (!name) return [];
    const status = githubJobStatus(step.status, step.conclusion);
    return [
      {
        number: asInt(step.number) ?? index + 1,
        name,
        status: status === "queued" ? "pending" : status,
        started_at: asDate(step.started_at)?.toISOString() ?? null,
        completed_at: asDate(step.completed_at)?.toISOString() ?? null,
      },
    ];
  });
}

export function mapWorkflowJob(job: Payload): MappedJob | null {
  const jobId = asText(job.id, 32);
  const runId = asText(job.run_id, 32);
  const name = asText(job.name);
  if (!jobId || !runId || !name) return null;
  const status = githubJobStatus(job.status, job.conclusion);
  const started =
    status === "running" || status === "succeeded" || status === "failed" || status === "cancelled";
  return {
    jobId,
    runId,
    attempt: asInt(job.run_attempt) ?? 1,
    name,
    status,
    url: asText(job.html_url, 2000),
    runner: asText(job.runner_name),
    steps: mapSteps(job.steps),
    startedAt: started ? asDate(job.started_at) : null,
    finishedAt:
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "skipped"
        ? asDate(job.completed_at)
        : null,
  };
}
