import {
  normaliseProjectConfig,
  validateProjectConfig,
  type ProjectConfig,
  type ResolvedProjectConfig,
} from "@capuchoo/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Configuration and credential storage.
 *
 * Two files, with distinct jobs:
 *
 *   ~/.capuchoo/config.json        credentials and preferences. Never committed.
 *   <app>/.capuchoo/project.json   which app this directory publishes.
 *                                 Committed - it is not a secret.
 *
 * The old `ConfigManager` merged both into one flat object and then read
 * `apiKey` out of the result, which meant a project.json could override the
 * credentials of whoever ran the deploy. Keeping them separate removes that,
 * and removes the 40-field `CapuchoConfig` interface that had accumulated every
 * key any command had ever wanted.
 */

const DIR = ".capuchoo";
const GLOBAL_FILE = "config.json";
const PROJECT_FILE = "project.json";

export interface GlobalConfig {
  endpoint?: string;
  apiKey?: string;
  user?: { id: string; email: string };
  authenticatedAt?: string;
  defaultChannel?: string;
}

/** Credentials resolved for this invocation, and where they came from. */
export interface Credentials {
  endpoint: string;
  apiKey: string;
  source: "environment" | "config";
}

export function globalConfigPath(): string {
  return path.join(os.homedir(), DIR, GLOBAL_FILE);
}

export function projectConfigPath(appDir: string): string {
  return path.join(appDir, DIR, PROJECT_FILE);
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    throw new Error(`${file} is not valid JSON. Fix or delete it.`);
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function readGlobalConfig(): GlobalConfig {
  return readJson<GlobalConfig>(globalConfigPath()) ?? {};
}

export function writeGlobalConfig(config: GlobalConfig): void {
  const file = globalConfigPath();
  writeJson(file, config);

  // The file holds an API key. Restrict it where the platform supports it;
  // Windows ACLs are not modelled by chmod, so failure is not fatal.
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* best effort */
  }
}

export function updateGlobalConfig(patch: Partial<GlobalConfig>): GlobalConfig {
  const next = { ...readGlobalConfig(), ...patch };
  for (const key of Object.keys(next) as Array<keyof GlobalConfig>) {
    if (next[key] === undefined) delete next[key];
  }
  writeGlobalConfig(next);
  return next;
}

/**
 * Resolves credentials.
 *
 * Environment variables win, and are never written to disk. That is what makes
 * a CI run safe: `CAPUCHOO_API_KEY` lives in the job for its lifetime and leaves
 * nothing behind on the runner.
 */
export function resolveCredentials(): Credentials | null {
  const envEndpoint = process.env.CAPUCHOO_ENDPOINT;
  const envKey = process.env.CAPUCHOO_API_KEY;

  if (envEndpoint && envKey) {
    return {
      endpoint: envEndpoint.replace(/\/+$/, ""),
      apiKey: envKey,
      source: "environment",
    };
  }

  const config = readGlobalConfig();
  if (config.endpoint && config.apiKey) {
    return {
      endpoint: config.endpoint.replace(/\/+$/, ""),
      apiKey: config.apiKey,
      source: "config",
    };
  }

  return null;
}

export function readProjectConfig(appDir: string): ProjectConfig | null {
  return readJson<ProjectConfig>(projectConfigPath(appDir));
}

export function writeProjectConfig(appDir: string, config: ProjectConfig): void {
  writeJson(projectConfigPath(appDir), config);
}

/**
 * Loads and validates the project config, resolving every default.
 *
 * Throws with the list of problems rather than returning null, so callers do
 * not each reinvent the error message.
 */
export function requireProjectConfig(appDir: string): ResolvedProjectConfig {
  const raw = readProjectConfig(appDir);
  const problems = validateProjectConfig(raw);

  if (problems.length > 0) {
    const location = path.relative(process.cwd(), projectConfigPath(appDir));
    throw new Error(
      `${location} is not usable:\n  - ${problems.join("\n  - ")}\n\n` +
        `Run "capuchoo init" in this directory to create it.`,
    );
  }

  return normaliseProjectConfig(raw as ProjectConfig);
}

/** Reads the application's semantic version from its package.json. */
export function readAppVersion(appDir: string): string {
  const file = path.join(appDir, "package.json");
  const pkg = readJson<{ version?: string }>(file);

  if (!pkg?.version) {
    throw new Error(`${file} has no "version" field, so there is nothing to publish.`);
  }

  return pkg.version;
}

/**
 * Writes a new version to the application's package.json.
 *
 * This replaces `npm version <type> --no-git-tag-version`. In a workspace npm
 * resolves the nearest package.json from the *process* working directory, so
 * running it from a monorepo root bumped the root package rather than the app.
 * Writing the file directly also leaves the rest of it byte-identical, instead
 * of npm reformatting the whole file.
 */
export function writeAppVersion(appDir: string, version: string): void {
  const file = path.join(appDir, "package.json");
  const contents = fs.readFileSync(file, "utf8");

  // Replace only the top-level "version" value, preserving formatting.
  const updated = contents.replace(/^(\s*"version"\s*:\s*")[^"]*(")/m, `$1${version}$2`);

  if (updated === contents) {
    throw new Error(`Could not update the version field in ${file}`);
  }

  fs.writeFileSync(file, updated);
}
