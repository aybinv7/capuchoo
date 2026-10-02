import type { BuildStatus, JobStatus, PipelinePlan, PipelinePlanJob } from "@capuchoo/core";
import { PIPELINE_PLAN_LIMITS } from "@capuchoo/core";
import { asDate, asRecord, asText } from "../github/run-mapper";
import type { JobReport } from "../repositories/build-jobs";
import type { RunReport } from "../repositories/builds";

const PIPELINE_STATUS: Record<string, BuildStatus> = {
  created: "queued",
  waiting_for_resource: "queued",
  preparing: "queued",
  pending: "queued",
  scheduled: "queued",
  manual: "running",
  running: "running",
  success: "succeeded",
  failed: "failed",
  canceled: "cancelled",
  canceling: "cancelled",
  skipped: "cancelled",
};

const JOB_STATUS: Record<string, JobStatus> = {
  created: "pending",
  pending: "queued",
  waiting_for_resource: "queued",
  preparing: "queued",
  scheduled: "queued",
  manual: "waiting",
  running: "running",
  success: "succeeded",
  failed: "failed",
  canceled: "cancelled",
  canceling: "cancelled",
  skipped: "skipped",
};

export const gitlabRunStatus = (status: unknown): BuildStatus =>
  PIPELINE_STATUS[String(status)] ?? "running";
export const gitlabJobStatus = (status: unknown): JobStatus =>
  JOB_STATUS[String(status)] ?? "pending";

const TERMINAL = new Set<JobStatus>(["succeeded", "failed", "cancelled", "skipped"]);

export function mapPipeline(appId: string, hook: Record<string, unknown>): RunReport | null {
  const attributes = asRecord(hook.object_attributes);
  const id = asText(attributes.id, 32);
  if (!id) return null;
  const status = gitlabRunStatus(attributes.status);
  const finished = status === "succeeded" || status === "failed" || status === "cancelled";
  return {
    app_id: appId,
    source: "gitlab",
    external_id: id,
    status,
    commit_sha: asText(attributes.sha, 64),
    ref: asText(attributes.ref),
    pipeline_url: asText(attributes.url, 2000) ?? asText(asRecord(hook.project).web_url, 2000),
    title: asText(attributes.name) ?? asText(asRecord(hook.commit).title),
    workflow: ".gitlab-ci.yml",
    trigger: asText(attributes.source, 64),
    error: status === "failed" ? (asText(attributes.detailed_status, 2000) ?? "failed") : null,
    started_at: asDate(attributes.created_at),
    finished_at: finished ? (asDate(attributes.finished_at) ?? null) : null,
  };
}

/** The pipeline's jobs in stage order: GitLab sends every job with each pipeline event. */
export function planFromPipeline(hook: Record<string, unknown>): PipelinePlan | null {
  const attributes = asRecord(hook.object_attributes);
  const builds = Array.isArray(hook.builds) ? hook.builds.map(asRecord) : [];
  const stages = Array.isArray(attributes.stages)
    ? attributes.stages.filter((stage): stage is string => typeof stage === "string")
    : [
        ...new Set(
          builds
            .map((build) => asText(build.stage))
            .filter((stage): stage is string => Boolean(stage)),
        ),
      ];
  const seen = new Set<string>();
  const jobs: PipelinePlanJob[] = [];
  for (const build of builds.slice(0, PIPELINE_PLAN_LIMITS.jobs)) {
    const name = asText(build.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    jobs.push({
      key: name,
      name,
      needs: [],
      stage: asText(build.stage),
      gated: build.when === "manual" || build.manual === true || build.status === "manual",
      condition: null,
    });
  }
  const stageIndex = new Map(stages.map((stage, index) => [stage, index]));
  jobs.sort((a, b) => (stageIndex.get(a.stage ?? "") ?? 0) - (stageIndex.get(b.stage ?? "") ?? 0));
  return jobs.length > 0 ? { provider: "gitlab", source: ".gitlab-ci.yml", stages, jobs } : null;
}

function jobUrl(hook: Record<string, unknown>, jobId: string): string | null {
  const web =
    asText(asRecord(hook.project).web_url, 1900) ??
    asText(asRecord(hook.repository).homepage, 1900);
  return web ? `${web.replace(/\/+$/, "")}/-/jobs/${jobId}` : null;
}

function job(
  buildId: string,
  hook: Record<string, unknown>,
  fields: {
    id: unknown;
    name: unknown;
    stage: unknown;
    status: unknown;
    started: unknown;
    finished: unknown;
    runner: unknown;
  },
): JobReport | null {
  const externalId = asText(fields.id, 32);
  const name = asText(fields.name);
  if (!externalId || !name) return null;
  const status = gitlabJobStatus(fields.status);
  return {
    buildId,
    externalId,
    planKey: name,
    name,
    stage: asText(fields.stage),
    status,
    attempt: 1,
    url: jobUrl(hook, externalId),
    runner: asText(asRecord(fields.runner).description),
    steps: null,
    startedAt: asDate(fields.started),
    finishedAt: TERMINAL.has(status) ? asDate(fields.finished) : null,
  };
}

/** Every job a pipeline event lists. */
export function jobsFromPipeline(buildId: string, hook: Record<string, unknown>): JobReport[] {
  const builds = Array.isArray(hook.builds) ? hook.builds.map(asRecord) : [];
  return builds.slice(0, PIPELINE_PLAN_LIMITS.jobs).flatMap((build) => {
    const report = job(buildId, hook, {
      id: build.id,
      name: build.name,
      stage: build.stage,
      status: build.status,
      started: build.started_at,
      finished: build.finished_at,
      runner: build.runner,
    });
    return report ? [report] : [];
  });
}

/** The one job a job event describes. */
export function jobFromJobHook(buildId: string, hook: Record<string, unknown>): JobReport | null {
  return job(buildId, hook, {
    id: hook.build_id,
    name: hook.build_name,
    stage: hook.build_stage,
    status: hook.build_status,
    started: hook.build_started_at,
    finished: hook.build_finished_at,
    runner: hook.runner,
  });
}
