import type { Deps } from "../http/context";
import { safeEqual, sha256Hex } from "../lib/crypto";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import { asRecord, asText } from "../github/run-mapper";
import { findApp, isUuid } from "../repositories/apps";
import { upsertBuildJob } from "../repositories/build-jobs";
import { setRunPlan, upsertRun } from "../repositories/builds";
import { findIntegration, touchIntegration } from "../repositories/integrations";
import { publishBuild, publishBuildJob } from "../services/build-feed";
import { jobFromJobHook, jobsFromPipeline, mapPipeline, planFromPipeline } from "./mapper";

/**
 * Ingests a GitLab pipeline or job webhook as a run and its jobs. A pipeline event carries every
 * job and the stage order, so it also sets the plan. Redelivery and reordering are harmless.
 */
export async function handleGitlabHook(
  deps: Deps,
  input: { appReference: string; token: string | undefined; body: unknown },
): Promise<{ handled: boolean }> {
  const app = isUuid(input.appReference) ? await findApp(deps.db, input.appReference) : undefined;
  if (!app) throw notFound("Integration");
  const integration = await findIntegration(deps.db, app.id, "gitlab");
  if (
    !integration?.secret_hash ||
    !input.token ||
    !safeEqual(sha256Hex(input.token), integration.secret_hash)
  ) {
    throw unauthorized("Invalid webhook token");
  }

  const hook = asRecord(input.body);
  const kind = asText(hook.object_kind);
  if (!kind) throw badRequest("Not a GitLab webhook payload");
  await touchIntegration(deps.db, integration.id, deps.now());

  if (kind === "pipeline") {
    const report = mapPipeline(app.id, hook);
    if (!report) return { handled: false };
    const { build, changed } = await upsertRun(deps.db, report);
    const plan = planFromPipeline(hook);
    if (plan) await setRunPlan(deps.db, build.id, plan);
    if (changed || plan)
      publishBuild(deps, { ...build, plan: plan ?? build.plan }, { withPlan: Boolean(plan) });
    for (const job of jobsFromPipeline(build.id, hook)) {
      publishBuildJob(deps, app.id, await upsertBuildJob(deps.db, job));
    }
    return { handled: true };
  }

  if (kind === "build") {
    const pipelineId = asText(hook.pipeline_id, 32);
    if (!pipelineId) return { handled: false };
    const { build, changed } = await upsertRun(deps.db, {
      app_id: app.id,
      source: "gitlab",
      external_id: pipelineId,
      status: hook.build_status === "running" ? "running" : "queued",
      commit_sha: asText(hook.sha, 64),
      ref: asText(hook.ref),
    });
    if (changed) publishBuild(deps, build);
    const job = jobFromJobHook(build.id, hook);
    if (job) publishBuildJob(deps, app.id, await upsertBuildJob(deps.db, job));
    return { handled: true };
  }

  return { handled: false };
}
