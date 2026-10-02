import { isFlavour } from "@capuchoo/core";
import { requireApp } from "../access/app-access";
import { actorColumns, type Principal } from "../auth/principal";
import type { Build, BuildEvent, BuildStatus } from "../db/schema";
import type { Deps } from "../http/context";
import { badRequest, conflict, notFound } from "../lib/errors";
import { isUuid } from "../repositories/apps";
import {
  addBuildEvent,
  createBuild,
  findBuild,
  setBuildStatus,
  upsertRun,
} from "../repositories/builds";
import { publishBuild, publishBuildEvent } from "./build-feed";
import { findBundle, findNativeBuild } from "../repositories/artefacts";
import { findChannelByName } from "../repositories/channels";

const STEP = /^[a-z][a-z0-9_:-]{0,63}$/;
const EVENT_STATUS = new Set<BuildEvent["status"]>([
  "running",
  "succeeded",
  "failed",
  "skipped",
  "info",
]);
const FINAL = new Set<BuildStatus>(["succeeded", "failed", "cancelled"]);

function optionalText(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

const RUN_ID = /^[0-9]{1,20}$/;
const JOB_KEY = /^[A-Za-z0-9_.:\- ()/]{1,255}$/;

/**
 * The CI run a deploy happens inside, created if its webhook has not arrived yet. Only the ids
 * the CI runner exposes are trusted, and only to attach this app's deploy to this app's run.
 */
async function parentRun(
  deps: Deps,
  appId: string,
  value: unknown,
  facts: { commit: string | null; ref: string | null; pipelineUrl: string | null },
): Promise<{ build: Build; job: string } | null> {
  if (!value || typeof value !== "object") return null;
  const ci = value as Record<string, unknown>;
  const source = ci.provider === "github" || ci.provider === "gitlab" ? ci.provider : null;
  const runId =
    typeof ci.run_id === "string" || typeof ci.run_id === "number" ? String(ci.run_id) : "";
  const job = typeof ci.job === "string" ? ci.job.trim() : "";
  if (!source || !RUN_ID.test(runId) || !JOB_KEY.test(job)) return null;
  const attempt =
    Number.isInteger(ci.run_attempt) && (ci.run_attempt as number) > 0
      ? (ci.run_attempt as number)
      : null;
  const { build, changed } = await upsertRun(deps.db, {
    app_id: appId,
    source,
    external_id: runId,
    status: "running",
    run_attempt: attempt,
    commit_sha: facts.commit,
    ref: facts.ref,
    pipeline_url: facts.pipelineUrl,
    started_at: deps.now(),
  });
  if (changed) publishBuild(deps, build);
  return { build, job };
}

/** Opens a build record the CLI reports progress into. */
export async function openBuild(
  deps: Deps,
  principal: Principal,
  appReference: string,
  body: Record<string, unknown>,
): Promise<Build> {
  const access = await requireApp(
    deps.db,
    principal,
    appReference,
    "developer",
    "Reporting a build",
  );
  const kind = body.kind === "native" ? "native" : body.kind === "ota" ? "ota" : null;
  if (!kind) throw badRequest("kind must be ota or native");
  const channelName = optionalText(body.channel, 64);
  const channel = channelName
    ? await findChannelByName(deps.db, access.app.id, channelName)
    : undefined;
  const source = ["gitlab", "github", "cli", "other"].includes(String(body.source))
    ? (body.source as Build["source"])
    : "cli";

  const parent = await parentRun(deps, access.app.id, body.ci, {
    commit: optionalText(body.commit, 64),
    ref: optionalText(body.ref, 255),
    pipelineUrl: optionalText(body.pipeline_url, 2000),
  });

  const build = await createBuild(deps.db, {
    parent_id: parent?.build.id ?? null,
    job_key: parent?.job ?? null,
    app_id: access.app.id,
    channel_id: channel?.id ?? null,
    channel_name: channelName,
    kind,
    status: "running",
    version_name: optionalText(body.version, 64),
    version_code: Number.isInteger(body.version_code) ? (body.version_code as number) : null,
    flavour: isFlavour(body.flavour) ? body.flavour : (channel?.environment ?? null),
    source,
    commit_sha: optionalText(body.commit, 64),
    ref: optionalText(body.ref, 255),
    pipeline_url: optionalText(body.pipeline_url, 2000),
    job_url: optionalText(body.job_url, 2000),
    started_at: deps.now(),
    ...actorColumns(principal),
  });
  publishBuild(deps, build);
  return build;
}

async function ownBuild(deps: Deps, principal: Principal, buildId: string): Promise<Build> {
  const build = await findBuild(deps.db, buildId);
  if (!build) throw notFound("Build");
  await requireApp(deps.db, principal, build.app_id, "developer", "Reporting a build");
  return build;
}

export async function appendBuildEvent(
  deps: Deps,
  principal: Principal,
  buildId: string,
  body: Record<string, unknown>,
): Promise<BuildEvent> {
  const build = await ownBuild(deps, principal, buildId);
  if (FINAL.has(build.status)) throw conflict("The build has already finished", "build_finished");
  const step = typeof body.step === "string" ? body.step.trim().toLowerCase() : "";
  if (!STEP.test(step)) throw badRequest("step must be a short lowercase identifier");
  const status = EVENT_STATUS.has(body.status as BuildEvent["status"])
    ? (body.status as BuildEvent["status"])
    : "info";
  const event = await addBuildEvent(deps.db, {
    buildId,
    step,
    status,
    message: optionalText(body.message, 2000),
  });
  publishBuildEvent(deps, build, event);
  return event;
}

export async function finishBuild(
  deps: Deps,
  principal: Principal,
  buildId: string,
  body: Record<string, unknown>,
): Promise<Build> {
  const build = await ownBuild(deps, principal, buildId);
  if (FINAL.has(build.status)) return build;
  const status: BuildStatus = FINAL.has(body.status as BuildStatus)
    ? (body.status as BuildStatus)
    : "failed";
  const bundleId = optionalText(body.bundle_id, 64);
  const nativeId = optionalText(body.native_id, 64);
  const [bundle, native] = await Promise.all([
    bundleId && isUuid(bundleId) ? findBundle(deps.db, bundleId) : undefined,
    nativeId && isUuid(nativeId) ? findNativeBuild(deps.db, nativeId) : undefined,
  ]);
  const updated = await setBuildStatus(deps.db, buildId, {
    status,
    error: optionalText(body.error, 2000),
    bundle_id: bundle?.app_id === build.app_id ? bundle.id : null,
    native_id: native?.app_id === build.app_id ? native.id : null,
    finished_at: deps.now(),
  });
  publishBuild(deps, updated);
  return updated;
}
