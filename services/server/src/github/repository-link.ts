import { GITHUB_WORKFLOW_PATH } from "@capuchoo/core";
import type { Integration } from "../db/schema";
import type { Deps } from "../http/context";
import { badRequest, conflict } from "../lib/errors";
import {
  findIntegration,
  integrationConfig,
  upsertIntegration,
} from "../repositories/integrations";
import { asInstallation } from "./client";
import { requireInstallation, summarizeRepository } from "./installations";

const WORKFLOW_PATH = /^\.github\/workflows\/[A-Za-z0-9._-]{1,100}\.ya?ml$/;

export interface GithubLink {
  integration: Integration;
  installation: string;
  installationId: string;
  accountLogin: string;
  repository: string;
  repositoryId: number;
  htmlUrl: string;
  defaultBranch: string;
  workflowPath: string;
}

export function readGithubLink(integration: Integration): GithubLink | null {
  const config = integrationConfig(integration);
  const repository = typeof config.repository === "string" ? config.repository : null;
  const installationId =
    config.installation_id === undefined ? null : String(config.installation_id);
  if (!repository || !installationId || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return null;
  return {
    integration,
    installation: String(config.installation ?? ""),
    installationId,
    accountLogin: String(config.account_login ?? ""),
    repository,
    repositoryId: Number(config.repository_id ?? 0),
    htmlUrl: String(config.html_url ?? ""),
    defaultBranch: String(config.default_branch ?? "main"),
    workflowPath: String(config.workflow_path ?? GITHUB_WORKFLOW_PATH),
  };
}

/** The app's GitHub link, or a 409 telling the dashboard to connect a repository first. */
export async function requireGithubLink(deps: Deps, appId: string): Promise<GithubLink> {
  const integration = await findIntegration(deps.db, appId, "github");
  const link = integration ? readGithubLink(integration) : null;
  if (!link)
    throw conflict("This app is not connected to a GitHub repository", "github_not_linked");
  return link;
}

/** Workflow file name for the dispatch API, which addresses a workflow by its file name. */
export const workflowFile = (link: GithubLink): string =>
  link.workflowPath.split("/").pop() ?? "capuchoo.yml";

/**
 * Links an app to a repository its organization's installation can reach. The repository is read
 * back through the installation, so an id the installation cannot see is refused here rather than
 * failing later on the first run.
 */
export async function linkRepository(
  deps: Deps,
  app: { id: string; organization_id: string },
  input: { installation: unknown; repository_id: unknown; workflow_path: unknown },
): Promise<GithubLink> {
  if (typeof input.installation !== "string") throw badRequest("installation is required");
  const repositoryId = Number(input.repository_id);
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0)
    throw badRequest("repository_id is required");
  const workflowPath =
    input.workflow_path === undefined || input.workflow_path === null || input.workflow_path === ""
      ? GITHUB_WORKFLOW_PATH
      : String(input.workflow_path);
  if (!WORKFLOW_PATH.test(workflowPath))
    throw badRequest("workflow_path must be a file under .github/workflows");

  const installation = await requireInstallation(deps, app.organization_id, input.installation);
  const installationId = String(installation.installation_id);
  const repository = summarizeRepository(
    await asInstallation(deps, installationId).call<unknown>(
      "GET",
      `/repositories/${repositoryId}`,
      { allow: [404] },
    ),
  );
  if (!repository)
    throw badRequest("The installation cannot reach that repository", "github_repository");

  await upsertIntegration(deps.db, {
    appId: app.id,
    kind: "github",
    externalRef: String(repository.id),
    config: {
      installation: installation.id,
      installation_id: installationId,
      account_login: installation.account_login,
      repository: repository.full_name,
      repository_id: repository.id,
      html_url: repository.html_url,
      default_branch: repository.default_branch,
      workflow_path: workflowPath,
    },
  });
  return requireGithubLink(deps, app.id);
}
