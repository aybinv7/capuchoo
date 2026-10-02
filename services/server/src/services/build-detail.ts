import { requireApp } from "../access/app-access";
import type { Principal } from "../auth/principal";
import type { Deps } from "../http/context";
import { notFound } from "../lib/errors";
import { listBuildJobs } from "../repositories/build-jobs";
import { findBuild, listBuildEvents, listChildBuilds } from "../repositories/builds";
import { serializeBuild, serializeJob } from "./build-feed";

/** A build with everything the detail view draws: its events, jobs, plan and child deploys. */
export async function buildDetail(deps: Deps, who: Principal, buildId: string) {
  const build = await findBuild(deps.db, buildId);
  if (!build) throw notFound("Build");
  await requireApp(deps.db, who, build.app_id, "viewer", "Reading a build");
  const [events, jobs, children] = await Promise.all([
    listBuildEvents(deps.db, build.id),
    build.kind === "pipeline" ? listBuildJobs(deps.db, build.id) : Promise.resolve([]),
    build.kind === "pipeline" ? listChildBuilds(deps.db, build.id) : Promise.resolve([]),
  ]);
  const childEvents = await Promise.all(
    children.map((child) => listBuildEvents(deps.db, child.id)),
  );
  return {
    ...serializeBuild(build, { withPlan: true }),
    events,
    jobs: jobs.map(serializeJob),
    children: children.map((child, index) => ({ ...child, events: childEvents[index] ?? [] })),
  };
}
