import { describeCiRun, gitlabPipelineVariables, type CiRunRequest } from "@capuchoo/core";
import type { Principal } from "../auth/principal";
import { actorColumns } from "../auth/principal";
import type { Build, Integration } from "../db/schema";
import type { Deps } from "../http/context";
import { badRequest, conflict } from "../lib/errors";
import { asRecord, asText } from "../github/run-mapper";
import { upsertBuildJob } from "../repositories/build-jobs";
import { setRunPlan, upsertRun } from "../repositories/builds";
import {
  findIntegration,
  integrationConfig,
  setIntegrationCredential,
} from "../repositories/integrations";
import { publishBuild, publishBuildJob } from "../services/build-feed";
import { gitlabCall, validateGitlabBaseUrl, type GitlabTarget } from "./client";
import { jobsFromPipeline, mapPipeline, planFromPipeline } from "./mapper";

const tokenPurpose = (integration: Pick<Integration, "id">) => `gitlab.token:${integration.id}`;

export interface GitlabLink extends GitlabTarget {
  integration: Integration;
  webUrl: string | null;
  defaultBranch: string;
}

/** The app's GitLab trigger credentials, decrypted; null when none are stored or they cannot be read. */
export function readGitlabLink(deps: Deps, integration: Integration): GitlabLink | null {
  if (!integration.credential_enc) return null;
  const config = integrationConfig(integration);
  const baseUrl = typeof config.base_url === "string" ? config.base_url : null;
  const project = config.project_id !== undefined ? String(config.project_id) : null;
  if (!baseUrl || !project) return null;
  try {
    return {
      integration,
      baseUrl,
      project,
      token: deps.ci.secrets.open(integration.credential_enc, tokenPurpose(integration)),
      webUrl: typeof config.web_url === "string" ? config.web_url : null,
      defaultBranch: typeof config.default_branch === "string" ? config.default_branch : "main",
    };
  } catch {
    deps.logger.error("a stored GitLab token cannot be decrypted; was SECRET_KEY changed?", {
      integration: integration.id,
    });
    return null;
  }
}

export async function requireGitlabLink(deps: Deps, appId: string): Promise<GitlabLink> {
  const integration = await findIntegration(deps.db, appId, "gitlab");
  const link = integration ? readGitlabLink(deps, integration) : null;
  if (!link) throw conflict("This app cannot start GitLab pipelines yet", "gitlab_not_linked");
  return link;
}

/**
 * Stores a project access token once GitLab confirms it reaches the project. Needs the webhook to
 * exist first, because runs are recorded through it.
 */
export async function saveGitlabTrigger(deps: Deps, appId: string, body: Record<string, unknown>) {
  const integration = await findIntegration(deps.db, appId, "gitlab");
  if (!integration) throw conflict("Connect the GitLab webhook first", "gitlab_webhook_missing");
  const baseUrl = validateGitlabBaseUrl(deps, body.base_url);
  const project = typeof body.project === "string" ? body.project.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!project || project.length > 255) throw badRequest("project is required");
  if (!token || token.length > 255) throw badRequest("token is required");

  const found = asRecord(await gitlabCall<unknown>(deps, { baseUrl, project, token }, "GET", ""));
  const projectId = asText(found.id, 32);
  if (!projectId) throw badRequest("GitLab did not return the project", "gitlab_project");
  const config = {
    ...integrationConfig(integration),
    project: asText(found.path_with_namespace) ?? project,
    project_id: projectId,
    base_url: baseUrl,
    web_url: asText(found.web_url, 2000),
    default_branch: asText(found.default_branch) ?? "main",
  };
  await setIntegrationCredential(deps.db, integration.id, {
    credentialEnc: deps.ci.secrets.seal(token, tokenPurpose(integration)),
    config,
    externalRef: projectId,
  });
  return { can_trigger: true, project: config.project, base_url: baseUrl, web_url: config.web_url };
}

export async function removeGitlabTrigger(deps: Deps, appId: string): Promise<boolean> {
  const integration = await findIntegration(deps.db, appId, "gitlab");
  if (!integration?.credential_enc) return false;
  await setIntegrationCredential(deps.db, integration.id, { credentialEnc: null });
  return true;
}

async function recordPipeline(
  deps: Deps,
  link: GitlabLink,
  appId: string,
  pipeline: Record<string, unknown>,
  jobs: unknown[],
): Promise<Build> {
  const hook = { object_attributes: pipeline, builds: jobs, project: { web_url: link.webUrl } };
  const report = mapPipeline(appId, hook);
  if (!report) throw conflict("GitLab returned no pipeline", "gitlab_pipeline");
  const { build } = await upsertRun(deps.db, report);
  const plan = jobs.length > 0 ? planFromPipeline(hook) : null;
  if (plan) await setRunPlan(deps.db, build.id, plan);
  publishBuild(deps, { ...build, plan: plan ?? build.plan }, { withPlan: Boolean(plan) });
  for (const job of jobsFromPipeline(build.id, hook)) {
    publishBuildJob(deps, appId, await upsertBuildJob(deps.db, job));
  }
  return build;
}

export async function triggerGitlabPipeline(
  deps: Deps,
  who: Principal,
  appId: string,
  link: GitlabLink,
  request: CiRunRequest,
): Promise<{ build: Build; html_url: string | null }> {
  const variables = Object.entries(gitlabPipelineVariables(request)).map(([key, value]) => ({
    key,
    value,
    variable_type: "env_var",
  }));
  const pipeline = asRecord(
    await gitlabCall<unknown>(deps, link, "POST", "/pipeline", {
      body: { ref: request.ref, variables },
    }),
  );
  const { build } = await upsertRun(deps.db, {
    ...mapPipeline(appId, { object_attributes: { ...pipeline, source: "api" } })!,
    title: describeCiRun(request),
    ...actorColumns(who),
  });
  publishBuild(deps, build);
  return { build, html_url: asText(pipeline.web_url, 2000) };
}

const pipelinePath = (build: Build) => `/pipelines/${encodeURIComponent(build.external_id ?? "")}`;

export async function cancelGitlabPipeline(
  deps: Deps,
  link: GitlabLink,
  build: Build,
): Promise<void> {
  await gitlabCall(deps, link, "POST", `${pipelinePath(build)}/cancel`);
}

export async function retryGitlabPipeline(
  deps: Deps,
  link: GitlabLink,
  build: Build,
): Promise<void> {
  await gitlabCall(deps, link, "POST", `${pipelinePath(build)}/retry`);
}

export async function syncGitlabPipeline(
  deps: Deps,
  link: GitlabLink,
  build: Build,
): Promise<Build> {
  const [pipeline, jobs] = await Promise.all([
    gitlabCall<Record<string, unknown>>(deps, link, "GET", pipelinePath(build)),
    gitlabCall<unknown[]>(deps, link, "GET", `${pipelinePath(build)}/jobs`, {
      query: { per_page: 100 },
    }),
  ]);
  return recordPipeline(
    deps,
    link,
    build.app_id,
    pipeline,
    Array.isArray(jobs) ? jobs.map(toHookJob) : [],
  );
}

/** A job from the jobs API in the shape a pipeline webhook lists it. */
function toHookJob(value: unknown): Record<string, unknown> {
  const job = asRecord(value);
  return { ...job, runner: asRecord(job.runner) };
}

export async function gitlabRefs(deps: Deps, link: GitlabLink) {
  const [branches, tags] = await Promise.all([
    gitlabCall<unknown[]>(deps, link, "GET", "/repository/branches", { query: { per_page: 100 } }),
    gitlabCall<unknown[]>(deps, link, "GET", "/repository/tags", { query: { per_page: 100 } }),
  ]);
  const names = (items: unknown) =>
    (Array.isArray(items) ? items : [])
      .map((item) => asText(asRecord(item).name))
      .filter((name): name is string => Boolean(name));
  return { default_branch: link.defaultBranch, branches: names(branches), tags: names(tags) };
}
