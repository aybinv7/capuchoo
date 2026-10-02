import type { CiProvider, GithubWorkflowSecret } from "@capuchoo/core";
import type { Build } from "./build";

export type { CiProvider, GithubWorkflowSecret };

/** `GET /api/github/app`: the instance's GitHub App. */
export interface GithubAppStatus {
  configured: boolean;
  source: "env" | "database" | null;
  slug: string | null;
  name: string | null;
  html_url: string | null;
  owner: string | null;
  webhook_url: string;
  can_manage: boolean;
}

/** `POST /api/github/app/manifest`: posted to `action` as a form field named `manifest`. */
export interface GithubManifest {
  action: string;
  manifest: string;
}

export interface GithubInstallation {
  /** Capuchoo's id. */
  id: string;
  /** GitHub's id. */
  installation_id: string;
  account_login: string;
  account_type: "User" | "Organization";
  repository_selection: "all" | "selected" | null;
  suspended_at: string | null;
  html_url: string;
  created_at: string;
}

/** `GET /api/organizations/:orgId/github`. */
export interface OrganizationGithub {
  app: { configured: boolean; slug: string | null };
  can_manage: boolean;
  installations: GithubInstallation[];
}

export interface GithubRepository {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  pushed_at: string | null;
}

export interface GithubRepositoryList {
  repositories: GithubRepository[];
  truncated: boolean;
}

export interface AppCiGithub {
  installation: string;
  account_login: string;
  repository: { id: number; full_name: string; html_url: string; default_branch: string };
  workflow_path: string;
  connected_at: string;
  last_event_at: string | null;
}

export interface AppCiGitlab {
  project: string | null;
  base_url: string | null;
  can_trigger: boolean;
  last_event_at: string | null;
}

/** `GET /api/apps/:id/ci`. */
export interface AppCi {
  provider: CiProvider | null;
  github: AppCiGithub | null;
  gitlab: AppCiGitlab | null;
  can_run: boolean;
}

export type SecretRequirement = "always" | "native" | "optional";

/** `GET /api/apps/:id/ci/github/setup`. */
export interface GithubSetup {
  default_branch: string;
  workflow: {
    path: string;
    exists: boolean;
    generated: boolean;
    version: string | null;
    html_url: string | null;
    /** The version this server would generate now, when it says; enables "out of date". */
    expected_version?: string | null;
  };
  pull_request: { number: number; html_url: string; state: "open" | "closed" | "merged" } | null;
  secrets: Array<{ name: GithubWorkflowSecret; present: boolean; required: SecretRequirement }>;
  variable: { name: "CAPUCHOO_ENDPOINT"; value: string | null; expected: string };
  package_manager: "pnpm" | "npm" | "yarn" | "bun" | null;
}

export interface SetupPullRequestInput {
  dev_branch?: string;
  staging_branch?: string;
  clients?: string[];
  app_dir?: string;
}

/** The repository's sealed-box key, base64. */
export interface GithubPublicKey {
  key_id: string;
  key: string;
}

export interface EncryptedSecret {
  name: GithubWorkflowSecret;
  encrypted_value: string;
  key_id: string;
}

/** `GET /api/apps/:id/ci/refs`. */
export interface CiRefs {
  default_branch: string;
  branches: string[];
  tags: string[];
}

/** `POST /api/apps/:id/ci/runs`. */
export interface CiRunCreated {
  build: Build | null;
  html_url: string | null;
}

export interface GitlabTriggerInput {
  base_url: string;
  project: string;
  token: string;
}
