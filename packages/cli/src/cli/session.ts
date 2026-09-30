import type { ResolvedProjectConfig } from "@capuchoo/core";
import chalk from "chalk";
import { CloudClient } from "../services/cloud.js";
import { requireProjectConfig, resolveCredentials } from "../utils/config.js";
import { runnable } from "./invocation.js";

export interface Session {
  appDir: string;
  project: ResolvedProjectConfig;
  cloud: CloudClient;
}

/** The linked app in the working directory and a client for its endpoint; throws when either is missing. */
export function requireSession(appDir = process.cwd()): Session {
  const project = requireProjectConfig(appDir);
  const credentials = resolveCredentials();
  if (!credentials) {
    throw new Error(
      `Not authenticated. Run ${chalk.cyan(runnable("auth login"))}, or set CAPUCHOO_ENDPOINT and CAPUCHOO_API_KEY.`,
    );
  }
  return { appDir, project, cloud: new CloudClient(credentials.endpoint, credentials.apiKey) };
}
