import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClientTarget } from "./clients.js";

const VERSION_PLACEHOLDER = "__CAPUCHOO_CLI_VERSION__";
const CLIENTS_PLACEHOLDER = "__CAPUCHOO_CLIENTS__";
const DEV_BRANCH_PLACEHOLDER = "__CAPUCHOO_DEV_BRANCH__";
const STAGING_BRANCH_PLACEHOLDER = "__CAPUCHOO_STAGING_BRANCH__";
const JOBS_MARKER = "# capuchoo:deliver-jobs";
const PLACEHOLDERS = [
  VERSION_PLACEHOLDER,
  CLIENTS_PLACEHOLDER,
  DEV_BRANCH_PLACEHOLDER,
  STAGING_BRANCH_PLACEHOLDER,
  JOBS_MARKER,
];
const BRANCH = /^(?!.*\.\.)(?!\/)(?!.*\/$)[A-Za-z0-9._/-]{1,100}$/;

/** Resolved the same way from `src/ci` under tests and `dist/ci` once published. */
export function gitlabTemplatePath(): string {
  return fileURLToPath(new URL("../../templates/gitlab-ci.yml", import.meta.url));
}

export function readGitlabTemplate(): string {
  return fs.readFileSync(gitlabTemplatePath(), "utf8");
}

export interface GitlabCiOptions {
  cliVersion: string;
  clients: ClientTarget[];
  devBranch?: string;
  stagingBranch?: string;
}

function deliverJob(target: ClientTarget): string {
  return [
    `deliver:${target.client}:`,
    "  extends: .deliver",
    `  resource_group: capuchoo-${target.channel}`,
    "  variables:",
    `    CAPUCHOO_TARGET_CHANNEL: "${target.channel}"`,
  ].join("\n");
}

function branch(value: string, flag: string): string {
  if (!BRANCH.test(value)) throw new Error(`${flag} "${value}" is not a branch name.`);
  return value;
}

/** The template with the CLI version and release branches pinned and one manual deliver job per client. */
export function renderGitlabCi(template: string, options: GitlabCiOptions): string {
  if (PLACEHOLDERS.some((placeholder) => !template.includes(placeholder))) {
    throw new Error("The GitLab CI template is missing its placeholders; reinstall @capuchoo/cli.");
  }
  const devBranch = branch(options.devBranch ?? "dev", "--dev-branch");
  const stagingBranch = branch(options.stagingBranch ?? "staging", "--staging-branch");
  if (devBranch === stagingBranch) {
    throw new Error("--dev-branch and --staging-branch must be two different branches.");
  }
  const jobs =
    options.clients.length > 0
      ? options.clients.map(deliverJob).join("\n\n")
      : `${JOBS_MARKER} - none yet; re-run capuchoo ci init --gitlab --clients <a,b>`;
  return template
    .replaceAll(VERSION_PLACEHOLDER, options.cliVersion)
    .replaceAll(CLIENTS_PLACEHOLDER, options.clients.map((target) => target.client).join(" "))
    .replaceAll(DEV_BRANCH_PLACEHOLDER, devBranch)
    .replaceAll(STAGING_BRANCH_PLACEHOLDER, stagingBranch)
    .replace(JOBS_MARKER, jobs);
}
