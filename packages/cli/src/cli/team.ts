import type { Command } from "@oclif/core";
import chalk from "chalk";
import type { ResolvedProjectConfig } from "@capuchoo/core";
import { normaliseProjectConfig } from "@capuchoo/core";
import { CloudClient } from "../services/cloud.js";
import { readProjectConfig, resolveCredentials } from "../utils/config.js";

export const APP_ROLES = ["admin", "developer", "tester", "viewer"] as const;
export const ORG_ROLES = ["owner", "admin", "member"] as const;

/** Roles that may ship code, mirroring PUBLISH_ROLES on the server. */
export const PUBLISH_ROLES: readonly string[] = ["admin", "developer"];

export interface LinkedApp {
  cloud: CloudClient;
  project: ResolvedProjectConfig;
}

/** Credentials plus a linked app, or a clear error naming the missing half. */
export function requireLinkedApp(command: Command): LinkedApp {
  const credentials = resolveCredentials();
  if (!credentials) {
    command.error(`Not signed in. Run ${chalk.cyan("capuchoo auth login")}.`);
  }

  const raw = readProjectConfig(process.cwd());
  if (!raw) {
    command.error(`This directory is not linked to an app. Run ${chalk.cyan("capuchoo init")}.`);
  }

  return {
    cloud: new CloudClient(credentials.endpoint, credentials.apiKey),
    project: normaliseProjectConfig(raw),
  };
}

/** Credentials only, for commands that are not about one app. */
export function requireCloud(command: Command): CloudClient {
  const credentials = resolveCredentials();
  if (!credentials) {
    command.error(`Not signed in. Run ${chalk.cyan("capuchoo auth login")}.`);
  }

  return new CloudClient(credentials.endpoint, credentials.apiKey);
}
