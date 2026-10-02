import { matchPlanJob, parsePipelinePlan, type PipelinePlan } from "@capuchoo/core";
import type { Build } from "../db/schema";
import type { Deps } from "../http/context";
import { listBuildJobs, setJobPlanKey, upsertBuildJob } from "../repositories/build-jobs";
import { findBuild, setRunPlan, upsertRun } from "../repositories/builds";
import { publishBuild, publishBuildJob } from "../services/build-feed";
import { asInstallation } from "./client";
import type { MappedJob, MappedRun } from "./run-mapper";
import { parseGithubWorkflowPlan } from "./workflow-plan";

export interface RunLocation {
  installationId: string;
  repository: string;
}

/** Records a run report for one app and publishes it when anything changed. */
export async function recordRun(deps: Deps, appId: string, run: MappedRun): Promise<Build> {
  const { build, changed } = await upsertRun(deps.db, {
    app_id: appId,
    source: "github",
    external_id: run.runId,
    status: run.status,
    run_attempt: run.attempt,
    ...run.fields,
  });
  if (changed) publishBuild(deps, build);
  return build;
}

/** Records a job report against its run, matched to the planned job it is. */
export async function recordJob(deps: Deps, build: Build, job: MappedJob): Promise<void> {
  const plan = parsePipelinePlan(build.plan);
  const stored = await upsertBuildJob(deps.db, {
    buildId: build.id,
    externalId: job.jobId,
    planKey: matchPlanJob(plan, { name: job.name }),
    name: job.name,
    stage: null,
    status: job.status,
    attempt: job.attempt,
    url: job.url,
    runner: job.runner,
    steps: job.steps,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  });
  publishBuildJob(deps, build.app_id, stored);
}

const CONTENT_ACCEPT = "application/vnd.github.raw+json";

/** Reads the workflow file at the run's commit; null when it is gone or not a workflow. */
export async function fetchRunPlan(
  deps: Deps,
  location: RunLocation,
  path: string,
  sha: string,
): Promise<PipelinePlan | null> {
  const github = asInstallation(deps, location.installationId);
  const text = await github.call<string>(
    "GET",
    `/repos/${location.repository}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    { query: { ref: sha }, accept: CONTENT_ACCEPT, allow: [404] },
  );
  return typeof text === "string" ? parseGithubWorkflowPlan(text, path) : null;
}

/**
 * Attaches the job graph to a run in the background, once. The webhook answers GitHub first; the
 * plan follows as its own `build` event.
 */
export function schedulePlan(
  deps: Deps,
  build: Build,
  location: RunLocation,
  path: string | null,
  sha: string | null,
): void {
  if (build.plan || !path || !sha) return;
  deps.tasks.run("github plan", async () => {
    const plan = await fetchRunPlan(deps, location, path, sha);
    if (!plan) return;
    await setRunPlan(deps.db, build.id, plan);
    const fresh = await findBuild(deps.db, build.id);
    if (fresh) publishBuild(deps, fresh, { withPlan: true });
    for (const job of await listBuildJobs(deps.db, build.id)) {
      if (job.plan_key) continue;
      const planKey = matchPlanJob(plan, { name: job.name });
      if (planKey)
        publishBuildJob(deps, build.app_id, await setJobPlanKey(deps.db, job.id, planKey));
    }
  });
}
