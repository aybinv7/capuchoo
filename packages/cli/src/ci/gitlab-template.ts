import fs from "node:fs";
import { fileURLToPath } from "node:url";

const VERSION_PLACEHOLDER = "__CAPUCHOO_CLI_VERSION__";
const JOBS_MARKER = "# capuchoo:deliver-jobs";
const CLIENT_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Resolved the same way from `src/ci` under tests and `dist/ci` once published. */
export function gitlabTemplatePath(): string {
  return fileURLToPath(new URL("../../templates/gitlab-ci.yml", import.meta.url));
}

export function readGitlabTemplate(): string {
  return fs.readFileSync(gitlabTemplatePath(), "utf8");
}

export interface ClientTarget {
  client: string;
  channel: string;
}

/** `acme,beta` to client targets on `prod-<client>` channels; throws on an unusable name. */
export function parseClients(value: string | undefined): ClientTarget[] {
  if (!value) return [];
  const seen = new Set<string>();
  const targets: ClientTarget[] = [];

  for (const raw of value.split(",")) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (!CLIENT_NAME.test(name)) {
      throw new Error(
        `"${raw.trim()}" is not a usable client name: lowercase letters, digits and "-".`,
      );
    }
    const client = name.startsWith("prod-") ? name.slice(5) : name;
    if (!client || seen.has(client)) continue;
    seen.add(client);
    targets.push({ client, channel: `prod-${client}` });
  }

  return targets;
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

/** The template with the CLI version pinned and one manual deliver job per client. */
export function renderGitlabCi(
  template: string,
  cliVersion: string,
  clients: ClientTarget[],
): string {
  if (!template.includes(VERSION_PLACEHOLDER) || !template.includes(JOBS_MARKER)) {
    throw new Error("The GitLab CI template is missing its placeholders; reinstall @capuchoo/cli.");
  }
  const jobs =
    clients.length > 0
      ? clients.map(deliverJob).join("\n\n")
      : `${JOBS_MARKER} - none yet; re-run capuchoo ci init --gitlab --clients <a,b>`;
  return template.replaceAll(VERSION_PLACEHOLDER, cliVersion).replace(JOBS_MARKER, jobs);
}
