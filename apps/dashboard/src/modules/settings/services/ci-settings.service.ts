import { http } from "@/shared/api/http";
import type {
  AppCi,
  EncryptedSecret,
  GithubAppStatus,
  GithubManifest,
  GithubPublicKey,
  GithubRepositoryList,
  GithubSetup,
  GitlabTriggerInput,
  OrganizationGithub,
  SetupPullRequestInput,
} from "@/shared/types/ci";

export interface ManifestInput {
  organization?: string;
  visibility?: "private" | "public";
  name?: string;
}

const org = (organizationId: string) => `/organizations/${organizationId}/github`;
const appCi = (appId: string) => `/apps/${appId}/ci`;

export const fetchGithubApp = (signal?: AbortSignal) =>
  http.get<GithubAppStatus>("/github/app", undefined, signal);
export const createGithubManifest = (input: ManifestInput) =>
  http.post<GithubManifest>("/github/app/manifest", input);
export const deleteGithubApp = () => http.delete("/github/app");

export const fetchOrganizationGithub = (organizationId: string, signal?: AbortSignal) =>
  http.get<OrganizationGithub>(org(organizationId), undefined, signal);
export const fetchInstallUrl = (organizationId: string, returnPath: string) =>
  http.get<{ url: string }>(`${org(organizationId)}/install-url`, { return: returnPath });
export const unlinkInstallation = (organizationId: string, installationId: string) =>
  http.delete(`${org(organizationId)}/installations/${installationId}`);
export const fetchRepositories = (
  organizationId: string,
  installationId: string,
  search: string,
  signal?: AbortSignal,
) =>
  http.get<GithubRepositoryList>(
    `${org(organizationId)}/installations/${installationId}/repositories`,
    { q: search },
    signal,
  );

export const connectGithub = (
  appId: string,
  input: { installation: string; repository_id: number; workflow_path?: string },
) => http.put<AppCi>(`${appCi(appId)}/github`, input);
export const disconnectGithub = (appId: string) => http.delete(`${appCi(appId)}/github`);

export const fetchGithubSetup = (appId: string, signal?: AbortSignal) =>
  http.get<GithubSetup>(`${appCi(appId)}/github/setup`, undefined, signal);
export const openSetupPullRequest = (appId: string, input: SetupPullRequestInput) =>
  http.post<{ pull_request: NonNullable<GithubSetup["pull_request"]>; created: boolean }>(
    `${appCi(appId)}/github/setup/pull-request`,
    input,
  );
export const fetchGithubPublicKey = (appId: string) =>
  http.get<GithubPublicKey>(`${appCi(appId)}/github/public-key`);
export const putGithubSecrets = (appId: string, secrets: EncryptedSecret[]) =>
  http.put<unknown>(`${appCi(appId)}/github/secrets`, { secrets });
export const putGithubVariables = (appId: string) =>
  http.put<unknown>(`${appCi(appId)}/github/variables`, {});

export const saveGitlabTrigger = (appId: string, input: GitlabTriggerInput) =>
  http.put<unknown>(`/apps/${appId}/integrations/gitlab/trigger`, input);
export const removeGitlabTrigger = (appId: string) =>
  http.delete(`/apps/${appId}/integrations/gitlab/trigger`);
