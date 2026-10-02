import {
  GITHUB_WORKFLOW_PATH,
  GITHUB_WORKFLOW_SECRETS,
  GITHUB_WORKFLOW_VARIABLE,
  renderGithubWorkflow,
  type GithubWorkflowSecret,
} from "@capuchoo/core";
import path from "node:path";
import type { CiTarget } from "./ci-target.js";
import type { ClientTarget } from "./clients.js";
import { detectDefaultBranch } from "./default-branch.js";
import { findRepoRoot, relativeAppDir } from "./repo-root.js";

export type GithubSecretUse = "always" | "optional" | "native";

/** When the workflow reads each secret. Keyed by the full list, so a new secret in core must be classified here. */
export const GITHUB_SECRET_USE: Readonly<Record<GithubWorkflowSecret, GithubSecretUse>> = {
  CAPUCHOO_API_KEY: "always",
  CAPUCHOO_SIGNING_KEY: "optional",
  ANDROID_KEYSTORE_BASE64: "native",
  ANDROID_KEYSTORE_PASSWORD: "native",
  ANDROID_KEY_ALIAS: "native",
  ANDROID_KEY_PASSWORD: "native",
};

export interface GithubTargetInput {
  cwd: string;
  cliVersion: string;
  clients: ClientTarget[];
  devBranch: string;
  stagingBranch: string;
  defaultBranch?: string | undefined;
  /** Relative to the repository root. */
  appDir?: string | undefined;
  /** Relative to `cwd`; the workflow path at the repository root when absent. */
  output?: string | undefined;
}

export type DefaultBranchSource = "flag" | "origin" | "fallback";

function secretsBy(use: GithubSecretUse): string[] {
  return GITHUB_WORKFLOW_SECRETS.filter((name) => GITHUB_SECRET_USE[name] === use);
}

/** What to set up once the workflow is written. */
export function githubNextSteps(clients: ClientTarget[]): string[] {
  const lines = clients.map(
    (target) =>
      `deliver -> ${target.channel} (Run workflow, action deliver, client ${target.client})`,
  );
  if (clients.length > 0) {
    lines.push(
      `Each channel must exist: capuchoo channel create ${clients[0]!.channel} --client --base prod`,
      "",
    );
  }
  lines.push(
    `Repository variable  ${GITHUB_WORKFLOW_VARIABLE}  the backend base URL`,
    `Repository secrets   ${secretsBy("always").join(", ")}`,
    `                     ${secretsBy("optional").join(", ")} (optional, signs releases)`,
    `                     ${secretsBy("native").join(", ")} (native release builds)`,
    "The dashboard can set these up for a connected repository: App settings > CI.",
    `Add required reviewers to the prod environment${clients.length > 0 ? " and every prod-<client>" : ""} to make a person approve each publish.`,
  );
  return lines;
}

function locationWarnings(file: string, root: string): string[] {
  const workflows = path.join(root, ".github", "workflows");
  if (path.dirname(file) !== workflows) {
    return [
      `GitHub only runs workflows from .github/workflows at the repository root; ${file} will not run.`,
    ];
  }
  if (file !== path.join(root, GITHUB_WORKFLOW_PATH)) {
    return [
      `The dashboard reads ${GITHUB_WORKFLOW_PATH} unless the app's workflow path is set to this file.`,
    ];
  }
  return [];
}

/**
 * The GitHub Actions workflow for the repository around `cwd`, rendered by core exactly as the
 * dashboard's setup pull request renders it. Throws on an option core refuses.
 */
export async function resolveGithubTarget(
  input: GithubTargetInput,
  detect: (root: string) => Promise<string | null> = detectDefaultBranch,
): Promise<CiTarget> {
  const found = findRepoRoot(input.cwd);
  const root = found ?? path.resolve(input.cwd);
  const warnings: string[] = [];
  if (!found) {
    warnings.push(`No git repository at or above ${root}; treating it as the repository root.`);
  }

  const appDir = input.appDir ?? relativeAppDir(root, input.cwd) ?? ".";

  let defaultBranch = input.defaultBranch;
  let defaultBranchSource: DefaultBranchSource = "flag";
  if (defaultBranch === undefined) {
    const detected = found ? await detect(root) : null;
    defaultBranch = detected ?? "main";
    defaultBranchSource = detected ? "origin" : "fallback";
  }

  const contents = renderGithubWorkflow({
    cliVersion: input.cliVersion,
    appDir,
    defaultBranch,
    devBranch: input.devBranch,
    stagingBranch: input.stagingBranch,
    clients: input.clients.map((target) => target.client),
  });

  if (defaultBranchSource === "fallback") {
    warnings.push(
      'origin/HEAD is not recorded, so the default branch is "main". Pass --default-branch if it is not.',
    );
  }

  const file = input.output
    ? path.resolve(input.cwd, input.output)
    : path.join(root, GITHUB_WORKFLOW_PATH);
  warnings.push(...locationWarnings(file, root));

  return {
    provider: "github",
    file,
    contents,
    warnings,
    nextSteps: githubNextSteps(input.clients),
    details: {
      repositoryRoot: root,
      appDir,
      defaultBranch,
      defaultBranchSource,
      devBranch: input.devBranch,
      stagingBranch: input.stagingBranch,
      variable: GITHUB_WORKFLOW_VARIABLE,
      secrets: GITHUB_WORKFLOW_SECRETS.map((name) => ({ name, required: GITHUB_SECRET_USE[name] })),
    },
  };
}
