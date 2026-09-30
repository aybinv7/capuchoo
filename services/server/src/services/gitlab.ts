import type { BuildEvent, BuildStatus } from "../db/schema";
import type { Deps } from "../http/context";
import { safeEqual, sha256Hex } from "../lib/crypto";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import { findApp, isUuid } from "../repositories/apps";
import { addBuildEvent, upsertExternalBuild } from "../repositories/builds";
import { findIntegration, touchIntegration } from "../repositories/integrations";

const PIPELINE_STATUS: Record<string, BuildStatus> = {
  created: "queued",
  waiting_for_resource: "queued",
  preparing: "queued",
  pending: "queued",
  scheduled: "queued",
  manual: "queued",
  running: "running",
  success: "succeeded",
  failed: "failed",
  canceled: "cancelled",
  canceling: "cancelled",
  skipped: "cancelled",
};

const JOB_STATUS: Record<string, BuildEvent["status"]> = {
  running: "running",
  success: "succeeded",
  failed: "failed",
  canceled: "skipped",
  skipped: "skipped",
  manual: "info",
  created: "info",
  pending: "info",
};

type Hook = Record<string, unknown>;
const record = (value: unknown): Hook =>
  value && typeof value === "object" ? (value as Hook) : {};
const str = (value: unknown, max = 255): string | null =>
  typeof value === "string" && value
    ? value.slice(0, max)
    : typeof value === "number"
      ? String(value)
      : null;

function step(name: unknown): string {
  const slug = String(name ?? "job")
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return /^[a-z]/.test(slug) ? slug : `job-${slug || "unnamed"}`;
}

/** Ingests a GitLab pipeline or job webhook as a build and its events. Redelivery is idempotent. */
export async function handleGitlabHook(
  deps: Deps,
  input: { appReference: string; token: string | undefined; body: unknown },
): Promise<{ handled: boolean }> {
  const app = isUuid(input.appReference) ? await findApp(deps.db, input.appReference) : undefined;
  if (!app) throw notFound("Integration");
  const integration = await findIntegration(deps.db, app.id, "gitlab");
  if (!integration || !input.token || !safeEqual(sha256Hex(input.token), integration.secret_hash)) {
    throw unauthorized("Invalid webhook token");
  }

  const hook = record(input.body);
  const kind = str(hook.object_kind);
  if (!kind) throw badRequest("Not a GitLab webhook payload");
  await touchIntegration(deps.db, integration.id, deps.now());

  if (kind === "pipeline") {
    const attributes = record(hook.object_attributes);
    const pipelineId = str(attributes.id);
    if (!pipelineId) return { handled: false };
    const status = PIPELINE_STATUS[String(attributes.status)] ?? "running";
    const build = await upsertExternalBuild(deps.db, {
      app_id: app.id,
      kind: "pipeline",
      status,
      source: "gitlab",
      external_id: pipelineId,
      commit_sha: str(attributes.sha, 64),
      ref: str(attributes.ref),
      pipeline_url: str(attributes.url, 2000) ?? str(record(hook.project).web_url, 2000),
      started_at: attributes.created_at ? new Date(String(attributes.created_at)) : deps.now(),
      finished_at:
        status === "succeeded" || status === "failed" || status === "cancelled" ? deps.now() : null,
      error: status === "failed" ? (str(attributes.detailed_status) ?? "failed") : null,
    });
    deps.hub.publish({ type: "build", appId: app.id, data: build });
    return { handled: true };
  }

  if (kind === "build") {
    const pipelineId = str(hook.pipeline_id);
    if (!pipelineId) return { handled: false };
    const build = await upsertExternalBuild(deps.db, {
      app_id: app.id,
      kind: "pipeline",
      status: "running",
      source: "gitlab",
      external_id: pipelineId,
      commit_sha: str(hook.sha, 64),
      ref: str(hook.ref),
    });
    const event = await addBuildEvent(deps.db, {
      buildId: build.id,
      step: step(hook.build_name),
      status: JOB_STATUS[String(hook.build_status)] ?? "info",
      message:
        [str(hook.build_stage), str(hook.build_status), str(hook.build_failure_reason)]
          .filter(Boolean)
          .join(" · ") || null,
    });
    deps.hub.publish({
      type: "build_event",
      appId: app.id,
      data: { ...event, build_id: build.id },
    });
    return { handled: true };
  }

  return { handled: false };
}
