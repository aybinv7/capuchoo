import {
  isTerminalBuildStatus,
  parseCiRunRequest,
  roleRank,
  type CiRunRequest,
  type Environment,
} from "@capuchoo/core";
import { requireApp, requireDeliverRole, type AppAccess } from "../access/app-access";
import { findChannelByName } from "../repositories/channels";
import type { Principal } from "../auth/principal";
import type { Build } from "../db/schema";
import type { Deps } from "../http/context";
import { badRequest, conflict, notFound, tooManyRequests } from "../lib/errors";
import { findBuild } from "../repositories/builds";
import { findIntegration, integrationConfig } from "../repositories/integrations";
import { readGithubLink, requireGithubLink } from "../github/repository-link";
import {
  cancelGithubRun,
  dispatchGithubRun,
  githubRefs,
  rerunGithubRun,
  syncGithubRun,
} from "../github/runs";
import {
  cancelGitlabPipeline,
  gitlabRefs,
  readGitlabLink,
  requireGitlabLink,
  retryGitlabPipeline,
  syncGitlabPipeline,
  triggerGitlabPipeline,
} from "../gitlab/runs";

const SYNC_INTERVAL_MS = 10_000;

/** What the dashboard knows about an app's CI: which provider runs it and whether it can be started. */
export async function appCi(deps: Deps, who: Principal, appReference: string) {
  const access = await requireApp(deps.db, who, appReference, "viewer", "Reading CI settings");
  const [githubRow, gitlabRow] = await Promise.all([
    findIntegration(deps.db, access.app.id, "github"),
    findIntegration(deps.db, access.app.id, "gitlab"),
  ]);
  const github = githubRow ? readGithubLink(githubRow) : null;
  const gitlabConfig = gitlabRow ? integrationConfig(gitlabRow) : null;
  const gitlabCanTrigger = Boolean(gitlabRow && readGitlabLink(deps, gitlabRow));
  const developer = access.role !== null && roleRank(access.role) >= roleRank("developer");
  return {
    provider: github ? ("github" as const) : gitlabRow ? ("gitlab" as const) : null,
    github: github
      ? {
          installation: github.installation,
          account_login: github.accountLogin,
          repository: {
            id: github.repositoryId,
            full_name: github.repository,
            html_url: github.htmlUrl,
            default_branch: github.defaultBranch,
          },
          workflow_path: github.workflowPath,
          connected_at: github.integration.created_at,
          last_event_at: github.integration.last_event_at,
        }
      : null,
    gitlab: gitlabRow
      ? {
          project: typeof gitlabConfig?.project === "string" ? gitlabConfig.project : null,
          base_url: typeof gitlabConfig?.base_url === "string" ? gitlabConfig.base_url : null,
          can_trigger: gitlabCanTrigger,
          last_event_at: gitlabRow.last_event_at,
        }
      : null,
    can_run: developer && (Boolean(github) || gitlabCanTrigger),
  };
}

/** GitHub when the app is linked to a repository, else GitLab when it can trigger. */
async function provider(deps: Deps, appId: string): Promise<"github" | "gitlab"> {
  const github = await findIntegration(deps.db, appId, "github");
  if (github && readGithubLink(github)) return "github";
  const gitlab = await findIntegration(deps.db, appId, "gitlab");
  if (gitlab && readGitlabLink(deps, gitlab)) return "gitlab";
  throw conflict("Connect GitHub or GitLab to start pipelines from Capuchoo", "ci_not_linked");
}

/**
 * A run publishes with the repository's key, not the caller's, so starting one must need the role
 * that publishing to its target needs. A run with no channel takes it from the ref, which may be
 * a tag and so prod; it is treated as prod rather than guessed.
 */
async function requireRunRole(deps: Deps, access: AppAccess, request: CiRunRequest): Promise<void> {
  if (request.action === "check") return;
  let environment: Environment = "prod";
  if (request.action !== "deliver" && request.channel) {
    const channel = await findChannelByName(deps.db, access.app.id, request.channel);
    if (!channel) throw badRequest(`There is no channel ${request.channel}`, "unknown_channel");
    environment = channel.environment;
  }
  requireDeliverRole(access, environment, "Starting a pipeline");
}

export async function startRun(
  deps: Deps,
  who: Principal,
  appReference: string,
  body: Record<string, unknown>,
) {
  const access = await requireApp(deps.db, who, appReference, "developer", "Starting a pipeline");
  const parsed = parseCiRunRequest(body);
  if (!parsed.ok) throw badRequest(parsed.message, "invalid_run", { field: parsed.field });
  const appId = access.app.id;
  await requireRunRole(deps, access, parsed.request);
  const result =
    (await provider(deps, appId)) === "github"
      ? await dispatchGithubRun(
          deps,
          who,
          appId,
          await requireGithubLink(deps, appId),
          parsed.request,
        )
      : await triggerGitlabPipeline(
          deps,
          who,
          appId,
          await requireGitlabLink(deps, appId),
          parsed.request,
        );
  return { ...result, access, request: parsed.request };
}

export async function runRefs(deps: Deps, who: Principal, appReference: string) {
  const access = await requireApp(deps.db, who, appReference, "developer", "Listing branches");
  const appId = access.app.id;
  return (await provider(deps, appId)) === "github"
    ? githubRefs(deps, await requireGithubLink(deps, appId))
    : gitlabRefs(deps, await requireGitlabLink(deps, appId));
}

async function ownRun(
  deps: Deps,
  who: Principal,
  buildId: string,
  minimum: "viewer" | "developer",
  action: string,
): Promise<{ build: Build; access: AppAccess }> {
  const build = await findBuild(deps.db, buildId);
  if (!build) throw notFound("Build");
  const access = await requireApp(deps.db, who, build.app_id, minimum, action);
  if (
    build.kind !== "pipeline" ||
    !build.external_id ||
    (build.source !== "github" && build.source !== "gitlab")
  ) {
    throw conflict("Only a CI pipeline run can do this", "not_a_pipeline");
  }
  return { build, access };
}

export async function cancelRun(deps: Deps, who: Principal, buildId: string): Promise<Build> {
  const { build } = await ownRun(deps, who, buildId, "developer", "Cancelling a pipeline");
  if (isTerminalBuildStatus(build.status)) return build;
  if (build.source === "github")
    await cancelGithubRun(deps, await requireGithubLink(deps, build.app_id), build);
  else await cancelGitlabPipeline(deps, await requireGitlabLink(deps, build.app_id), build);
  return build;
}

export async function rerunRun(
  deps: Deps,
  who: Principal,
  buildId: string,
  failedOnly: boolean,
): Promise<Build> {
  const { build } = await ownRun(deps, who, buildId, "developer", "Re-running a pipeline");
  if (!isTerminalBuildStatus(build.status)) throw conflict("The run is still going", "run_active");
  if (build.source === "github") {
    await rerunGithubRun(deps, await requireGithubLink(deps, build.app_id), build, failedOnly);
  } else {
    await retryGitlabPipeline(deps, await requireGitlabLink(deps, build.app_id), build);
  }
  return build;
}

/** Reads a run back from its provider; throttled per run, since every viewer of it may ask. */
export async function syncRun(deps: Deps, who: Principal, buildId: string): Promise<Build> {
  const { build } = await ownRun(deps, who, buildId, "viewer", "Refreshing a pipeline");
  if (!deps.ci.claim(`sync:${build.id}`, deps.now().getTime(), SYNC_INTERVAL_MS)) {
    throw tooManyRequests(Math.ceil(SYNC_INTERVAL_MS / 1000));
  }
  return build.source === "github"
    ? syncGithubRun(deps, await requireGithubLink(deps, build.app_id), build)
    : syncGitlabPipeline(deps, await requireGitlabLink(deps, build.app_id), build);
}
