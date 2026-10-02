import { parsePipelinePlan } from "@capuchoo/core";
import type { Build, BuildEvent, BuildJob } from "../db/schema";
import type { Deps } from "../http/context";

/** A build as clients see it; the plan only travels when asked for. */
export function serializeBuild(
  build: Build | Omit<Build, "plan">,
  options: { withPlan?: boolean } = {},
) {
  const { plan, ...rest } = build as Build;
  return options.withPlan ? { ...rest, plan: parsePipelinePlan(plan) } : rest;
}

export function serializeJob(job: BuildJob) {
  return { ...job, steps: Array.isArray(job.steps) ? job.steps : [] };
}

export function publishBuild(deps: Deps, build: Build, options: { withPlan?: boolean } = {}): void {
  deps.hub.publish({ type: "build", appId: build.app_id, data: serializeBuild(build, options) });
}

export function publishBuildJob(deps: Deps, appId: string, job: BuildJob): void {
  deps.hub.publish({ type: "build_job", appId, data: serializeJob(job) });
}

export function publishBuildEvent(deps: Deps, build: Build, event: BuildEvent): void {
  deps.hub.publish({
    type: "build_event",
    appId: build.app_id,
    data: { ...event, build_id: build.id },
  });
}
