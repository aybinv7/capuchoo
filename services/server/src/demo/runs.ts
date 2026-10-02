import {
  isTerminalJobStatus,
  type BuildStatus,
  type JobStatus,
  type PipelinePlan,
  type PipelineStep,
} from "@capuchoo/core";
import { checksumOf } from "./dice";
import { after, ago, type DemoContext, type PersonKey } from "./context";
import { stamp, type StepScript } from "./log-text";
import type { SeededApp } from "./releases";

export interface StepSpec {
  number: number;
  name: string;
  seconds: number;
  script: StepScript;
  /** Runs even after an earlier step failed: post steps and the job's completion. */
  always?: boolean;
}

export type DeployStepName =
  | "resolve"
  | "assets"
  | "web"
  | "native"
  | "sync"
  | "bundle"
  | "sign"
  | "upload";

export interface DeploySpec {
  kind: "ota" | "native";
  channel: string;
  version: string;
  versionCode?: number;
  bundle?: string;
  native?: string;
  failAt?: DeployStepName;
  runningAt?: DeployStepName;
  error?: string;
  /** Which step of the job the deploy runs in. */
  inStep: number;
}

export interface JobSpec {
  key: string;
  name?: string;
  stage?: string;
  status: JobStatus;
  /** Seconds after the run started. */
  startAfter: number;
  steps: StepSpec[];
  failAt?: number;
  runningAt?: number;
  deploy?: DeploySpec;
  /** GitLab: the whole trace, which has no steps. */
  trace?: string[];
  /** GitLab: how long a job without steps ran. */
  seconds?: number;
}

export interface RunSpec {
  source: "github" | "gitlab";
  runId: number;
  title: string;
  trigger: string;
  ref: string;
  startedAgoMs: number;
  status: BuildStatus;
  actor: PersonKey | null;
  plan: PipelinePlan;
  jobs: JobSpec[];
  workflow: string;
  runUrl: (runId: number) => string;
  jobUrl: (runId: number, jobId: number) => string;
  error?: string;
}

const DEPLOY_STEPS: Record<"ota" | "native", DeployStepName[]> = {
  ota: ["resolve", "assets", "web", "native", "sync", "bundle", "upload"],
  native: ["resolve", "assets", "web", "native", "sync", "bundle", "sign", "upload"],
};

const SKIPPED_FOR_OTA = new Set<DeployStepName>(["assets", "sync"]);

interface TimedStep {
  spec: StepSpec;
  status: JobStatus;
  started: Date | null;
  completed: Date | null;
}

function timeSteps(job: JobSpec, start: Date): TimedStep[] {
  if (
    job.status === "pending" ||
    job.status === "queued" ||
    job.status === "waiting" ||
    job.status === "skipped"
  ) {
    return [];
  }
  let cursor = start;
  let failed = false;
  const timed: TimedStep[] = [];
  for (const spec of job.steps) {
    if (job.runningAt !== undefined && spec.number > job.runningAt) {
      timed.push({ spec, status: "pending", started: null, completed: null });
      continue;
    }
    if (failed && !spec.always) {
      timed.push({ spec, status: "skipped", started: null, completed: null });
      continue;
    }
    const running = job.runningAt === spec.number;
    const failing = job.failAt === spec.number;
    const status: JobStatus = running
      ? "running"
      : failing
        ? job.status === "cancelled"
          ? "cancelled"
          : "failed"
        : "succeeded";
    const completed = running ? null : after(cursor, spec.seconds * 1000);
    timed.push({ spec, status, started: cursor, completed });
    if (failing) failed = true;
    if (completed) cursor = completed;
  }
  return timed;
}

const toStep = (step: TimedStep): PipelineStep => ({
  number: step.spec.number,
  name: step.spec.name,
  status: step.status,
  started_at: step.started?.toISOString() ?? null,
  completed_at: step.completed?.toISOString() ?? null,
});

function githubLog(steps: TimedStep[]): string {
  return steps
    .filter((step) => step.started)
    .flatMap((step) => stamp(step.spec.script, step.started!, step.spec.seconds))
    .join("\n");
}

async function seedDeploy(
  context: DemoContext,
  seeded: SeededApp,
  runBuildId: string,
  job: JobSpec,
  deploy: DeploySpec,
  inStep: TimedStep,
  actor: PersonKey | null,
  source: "github" | "gitlab",
  runUrl: string,
): Promise<void> {
  const channel = seeded.channels.get(deploy.channel);
  const started = inStep.started ?? context.now;
  const finished = deploy.runningAt ? null : (inStep.completed ?? started);
  const status: BuildStatus = deploy.runningAt ? "running" : deploy.failAt ? "failed" : "succeeded";
  const build = await context.trx
    .insertInto("builds")
    .values({
      app_id: seeded.id,
      parent_id: runBuildId,
      job_key: job.key,
      channel_id: channel?.id ?? null,
      channel_name: deploy.channel,
      kind: deploy.kind,
      status,
      version_name: deploy.version,
      version_code: deploy.versionCode ?? null,
      flavour: channel?.spec.environment ?? null,
      source,
      pipeline_url: runUrl,
      actor_user_id: actor ? context.people[actor] : null,
      bundle_id: deploy.bundle ? (seeded.bundles.get(deploy.bundle)?.id ?? null) : null,
      native_id: deploy.native ? (seeded.natives.get(deploy.native)?.id ?? null) : null,
      error: deploy.failAt ? (deploy.error ?? "failed") : null,
      started_at: started,
      finished_at: finished,
      created_at: started,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const steps = DEPLOY_STEPS[deploy.kind];
  const span = ((finished ?? context.now).getTime() - started.getTime()) / steps.length;
  const events = [];
  for (const [index, step] of steps.entries()) {
    const begin = new Date(started.getTime() + index * span);
    events.push({
      build_id: build.id,
      step,
      status: "running" as const,
      message: null,
      created_at: begin,
    });
    if (deploy.runningAt === step) break;
    const skipped = deploy.kind === "ota" && SKIPPED_FOR_OTA.has(step);
    const failed = deploy.failAt === step;
    events.push({
      build_id: build.id,
      step,
      status: failed
        ? ("failed" as const)
        : skipped
          ? ("skipped" as const)
          : ("succeeded" as const),
      message: failed
        ? (deploy.error ?? null)
        : skipped
          ? step === "sync"
            ? "no android/ project, and an OTA bundle does not need one"
            : "no launcher artwork"
          : null,
      created_at: new Date(begin.getTime() + span * 0.9),
    });
    if (failed) break;
  }
  await context.trx.insertInto("build_events").values(events).execute();
}

/** A CI run as a provider would have reported it: the run, its planned graph, its jobs and logs. */
export async function seedRun(
  context: DemoContext,
  seeded: SeededApp,
  spec: RunSpec,
): Promise<void> {
  const started = ago(context, spec.startedAgoMs);
  const timed = spec.jobs
    .map((job) => ({ job, start: after(started, job.startAfter * 1000) }))
    .map(({ job, start }) => ({ job, start, steps: timeSteps(job, start) }));
  const lastEnd = timed
    .flatMap((entry) => [
      ...entry.steps.map((step) => step.completed?.getTime() ?? 0),
      entry.steps.length === 0 &&
      isTerminalJobStatus(entry.job.status) &&
      entry.job.status !== "skipped"
        ? entry.start.getTime() + (entry.job.seconds ?? 60) * 1000
        : 0,
    ])
    .reduce((max, value) => Math.max(max, value), started.getTime());
  const finished =
    spec.status === "succeeded" || spec.status === "failed" || spec.status === "cancelled";
  const runUrl = spec.runUrl(spec.runId);

  const run = await context.trx
    .insertInto("builds")
    .values({
      app_id: seeded.id,
      kind: "pipeline",
      status: spec.status,
      source: spec.source,
      external_id: String(spec.runId),
      run_attempt: 1,
      commit_sha: checksumOf(`${seeded.catalog.appId}-${spec.runId}`).slice(0, 40),
      ref: spec.ref,
      pipeline_url: runUrl,
      title: spec.title,
      workflow: spec.workflow,
      trigger: spec.trigger,
      plan: JSON.stringify(spec.plan),
      actor_user_id: spec.actor ? context.people[spec.actor] : null,
      error: spec.status === "failed" ? (spec.error ?? "failure") : null,
      started_at: started,
      finished_at: finished ? new Date(lastEnd) : null,
      created_at: started,
      updated_at: finished ? new Date(lastEnd) : context.now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  for (const [index, entry] of timed.entries()) {
    const { job, start, steps } = entry;
    const jobId = spec.runId * 10 + index;
    const ran =
      job.status !== "pending" &&
      job.status !== "queued" &&
      job.status !== "waiting" &&
      job.status !== "skipped";
    const began = steps[0]?.started ?? (ran ? start : null);
    const ended =
      !isTerminalJobStatus(job.status) || !began
        ? null
        : (steps.at(-1)?.completed ?? after(start, (job.seconds ?? 60) * 1000));
    const row = await context.trx
      .insertInto("build_jobs")
      .values({
        build_id: run.id,
        external_id: String(jobId),
        plan_key: job.key,
        name: job.name ?? job.key,
        stage: job.stage ?? null,
        status: job.status,
        attempt: 1,
        url: spec.jobUrl(spec.runId, jobId),
        runner: began
          ? spec.source === "github"
            ? `GitHub Actions ${1000000600 + index}`
            : `northwind-runner-${(index % 3) + 1}`
          : null,
        steps: JSON.stringify(steps.map(toStep)),
        started_at: began,
        finished_at: ended,
        created_at: start,
        updated_at: ended ?? context.now,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    if (isTerminalJobStatus(job.status) && (steps.length > 0 || job.trace)) {
      const content = job.trace ? job.trace.join("\n") : githubLog(steps);
      if (content)
        await context.trx
          .insertInto("build_job_logs")
          .values({ job_id: row.id, content, truncated: false })
          .execute();
    }
    if (job.deploy) {
      const inStep = steps.find((step) => step.spec.number === job.deploy!.inStep);
      if (inStep?.started) {
        await seedDeploy(
          context,
          seeded,
          run.id,
          job,
          job.deploy,
          inStep,
          spec.actor,
          spec.source,
          runUrl,
        );
      }
    }
  }
}
