import { sql } from "kysely";
import type { Build, Integration } from "../db/schema";
import type { Deps } from "../http/context";
import { parseJson } from "../http/body";
import { hmacHex, safeEqual } from "../lib/crypto";
import { unauthorized } from "../lib/errors";
import { findRunByExternalId, upsertRun } from "../repositories/builds";
import {
  removeInstallationEverywhere,
  updateInstallationState,
} from "../repositories/github-installations";
import {
  findIntegrationsByRef,
  integrationConfig,
  setIntegrationConfig,
  touchIntegrations,
} from "../repositories/integrations";
import { asInstallation, requireGithubApp } from "./client";
import { recordJob, recordRun, schedulePlan } from "./run-ingest";
import { asDate, asRecord, asText, mapWorkflowJob, mapWorkflowRun } from "./run-mapper";

export interface GithubDelivery {
  event: string | undefined;
  signature: string | undefined;
  body: string;
}

type Outcome = { handled: boolean; apps?: number };

/** `X-Hub-Signature-256` over the exact bytes received. */
export function verifySignature(secret: string, body: string, header: string | undefined): boolean {
  if (!header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice(7), hmacHex(secret, body));
}

interface Target {
  integration: Integration;
  installationId: string;
  repository: string;
  workflowPath: string;
}

/** The apps a delivery is for: linked to this repository through this installation. */
async function targets(deps: Deps, payload: Record<string, unknown>): Promise<Target[]> {
  const repository = asRecord(payload.repository);
  const repositoryId = asText(repository.id, 32);
  const installationId = asText(asRecord(payload.installation).id, 32);
  if (!repositoryId || !installationId) return [];
  const integrations = await findIntegrationsByRef(deps.db, "github", repositoryId);
  const fullName = asText(repository.full_name);
  const matched: Target[] = [];
  for (const integration of integrations) {
    const config = integrationConfig(integration);
    if (asText(config.installation_id, 32) !== installationId) continue;
    if (fullName && REPOSITORY.test(fullName) && config.repository !== fullName) {
      await renameRepository(deps, integration, config, fullName);
    }
    matched.push({
      integration,
      installationId,
      repository: fullName ?? asText(config.repository) ?? "",
      workflowPath: asText(config.workflow_path, 300) ?? "",
    });
  }
  return matched;
}

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;

/** A renamed or transferred repository keeps its id; the stored name follows it. */
async function renameRepository(
  deps: Deps,
  integration: Integration,
  config: Record<string, unknown>,
  fullName: string,
): Promise<void> {
  const web = deps.config.GITHUB_WEB_URL.replace(/\/+$/, "");
  await setIntegrationConfig(deps.db, integration.id, {
    ...config,
    repository: fullName,
    html_url: `${web}/${fullName}`,
  });
}

async function onWorkflowRun(deps: Deps, payload: Record<string, unknown>): Promise<Outcome> {
  const linked = await targets(deps, payload);
  const run = mapWorkflowRun(asRecord(payload.workflow_run), null, null);
  if (!run || linked.length === 0) return { handled: false };
  const forWorkflow = linked.filter((target) => target.workflowPath === run.path);
  if (forWorkflow.length === 0) return { handled: false };
  const shared = forWorkflow.length > 1;
  let apps = 0;
  for (const target of forWorkflow) {
    const appId = target.integration.app_id;
    if (shared && !(await findRunByExternalId(deps.db, appId, "github", run.runId))) continue;
    const build = await recordRun(deps, appId, run);
    schedulePlan(deps, build, target, run.path, run.headSha);
    apps += 1;
  }
  await touchIntegrations(
    deps.db,
    forWorkflow.map((target) => target.integration.id),
    deps.now(),
  );
  return { handled: apps > 0, apps };
}

/**
 * A job arrived before its run. Job payloads do not name the workflow file, so the run is read
 * back and adopted only if it is the linked workflow; other workflows in the repository are not
 * Capuchoo's business.
 */
async function adoptRun(deps: Deps, target: Target, runId: string): Promise<Build | undefined> {
  const raw = await asInstallation(deps, target.installationId).call<Record<string, unknown>>(
    "GET",
    `/repos/${target.repository}/actions/runs/${encodeURIComponent(runId)}`,
    { allow: [404] },
  );
  const run = raw ? mapWorkflowRun(raw, null, null) : null;
  if (!run || run.path !== target.workflowPath) return undefined;
  const build = await recordRun(deps, target.integration.app_id, run);
  schedulePlan(deps, build, target, run.path, run.headSha);
  return build;
}

async function onWorkflowJob(deps: Deps, payload: Record<string, unknown>): Promise<Outcome> {
  const linked = await targets(deps, payload);
  const job = mapWorkflowJob(asRecord(payload.workflow_job));
  if (!job || linked.length === 0) return { handled: false };
  let apps = 0;
  for (const target of linked) {
    const appId = target.integration.app_id;
    let build =
      (await findRunByExternalId(deps.db, appId, "github", job.runId)) ??
      (linked.length === 1 ? await adoptRun(deps, target, job.runId) : undefined);
    if (!build) continue;
    if (job.status === "running" && build.status === "queued") {
      const { build: started } = await upsertRun(deps.db, {
        app_id: appId,
        source: "github",
        external_id: job.runId,
        status: "running",
        run_attempt: job.attempt,
        started_at: job.startedAt,
      });
      build = started;
    }
    await recordJob(deps, build, job);
    apps += 1;
  }
  await touchIntegrations(
    deps.db,
    linked.map((target) => target.integration.id),
    deps.now(),
  );
  return { handled: apps > 0, apps };
}

async function onInstallation(deps: Deps, payload: Record<string, unknown>): Promise<Outcome> {
  const installation = asRecord(payload.installation);
  const installationId = asText(installation.id, 32);
  if (!installationId) return { handled: false };
  switch (payload.action) {
    case "deleted":
      await deps.db
        .deleteFrom("integrations")
        .where("kind", "=", "github")
        .where(sql<string>`config->>'installation_id'`, "=", installationId)
        .execute();
      await removeInstallationEverywhere(deps.db, installationId);
      return { handled: true };
    case "suspend":
      await updateInstallationState(deps.db, installationId, {
        suspendedAt: asDate(installation.suspended_at) ?? deps.now(),
      });
      return { handled: true };
    case "unsuspend":
      await updateInstallationState(deps.db, installationId, { suspendedAt: null });
      return { handled: true };
    default: {
      const selection = installation.repository_selection;
      await updateInstallationState(deps.db, installationId, {
        accountLogin: asText(asRecord(installation.account).login) ?? undefined,
        repositorySelection:
          selection === "all" || selection === "selected" ? selection : undefined,
      });
      return { handled: true };
    }
  }
}

/**
 * The single GitHub webhook. The App's secret authenticates every delivery; nothing in the
 * payload is trusted to say which app it is for beyond the repository and installation ids,
 * which must both match a link made by an admin.
 */
export async function handleGithubDelivery(deps: Deps, delivery: GithubDelivery): Promise<Outcome> {
  const app = await requireGithubApp(deps);
  if (!verifySignature(app.webhookSecret, delivery.body, delivery.signature)) {
    throw unauthorized("Invalid webhook signature");
  }
  const payload = parseJson<Record<string, unknown>>(delivery.body);
  switch (delivery.event) {
    case "workflow_run":
      return onWorkflowRun(deps, payload);
    case "workflow_job":
      return onWorkflowJob(deps, payload);
    case "installation":
      return onInstallation(deps, payload);
    default:
      return { handled: false };
  }
}
