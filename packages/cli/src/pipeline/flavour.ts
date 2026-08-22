import {
  INITIAL_VERSION_CODES,
  nextVersionCode,
  versionEnv,
  type Environment,
  type FlavourConfig,
  type ResolvedProjectConfig,
  type VersionCodes,
} from "@capuchoo/core";
import fs from "node:fs";
import path from "node:path";

/**
 * Resolves everything a single build flavour needs.
 *
 * The previous implementation rewrote `VITE_APP_VERSION`, `VERSION_CODE` and
 * `BUILD_NUMBER` *into* the committed `build/<env>/.env.<env>` file on every
 * deploy. That had three consequences: every deploy left the working tree
 * dirty, two deploys running at once corrupted each other's values, and a
 * failed deploy left the file holding a version that was never published.
 *
 * Here the env file is read and never written. The computed values are merged
 * on top in memory and handed to the build and to Trapeze as environment
 * variables - which is where both of them look anyway.
 */

export interface ResolvedFlavour {
  environment: Environment;
  config: FlavourConfig;
  /** Absolute path, or null when the flavour declares none. */
  envFile: string | null;
  trapezeConfig: string | null;
  assetPath: string | null;
  /** Values parsed from the env file. */
  fileEnv: Record<string, string>;
  /** Vite mode for this flavour. */
  mode: string;
}

/**
 * Parses a dotenv file.
 *
 * Deliberately small and dependency-free: `KEY=value`, `#` comments, optional
 * surrounding quotes, `export ` prefix tolerated. Anything more exotic belongs
 * in the app's own tooling, not in a deploy tool.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf("=");
    if (separator <= 0) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_]\w*$/.test(key)) continue;

    let value = withoutExport.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    } else {
      // Strip a trailing inline comment on unquoted values only.
      const comment = value.indexOf(" #");
      if (comment >= 0) value = value.slice(0, comment).trimEnd();
    }

    values[key] = value;
  }

  return values;
}

function existingPath(appDir: string, relative: string | undefined): string | null {
  if (!relative) return null;
  const absolute = path.resolve(appDir, relative);
  return fs.existsSync(absolute) ? absolute : null;
}

export function resolveFlavour(
  appDir: string,
  project: ResolvedProjectConfig,
  environment: Environment,
): ResolvedFlavour {
  const config = project.flavours[environment];
  const envFile = existingPath(appDir, config.envFile);

  return {
    environment,
    config,
    envFile,
    trapezeConfig: existingPath(appDir, config.trapezeConfig),
    assetPath: existingPath(appDir, config.assetPath),
    fileEnv: envFile ? parseEnvFile(fs.readFileSync(envFile, "utf8")) : {},
    mode: config.mode ?? environment,
  };
}

/**
 * Problems that make a flavour unbuildable, as actionable messages.
 *
 * The old `syncVersion` threw `Env file for staging not found` from deep inside
 * the pipeline, *after* the version had been bumped. Checking up front means a
 * misconfigured flavour costs nothing.
 */
export function describeFlavourProblems(flavour: ResolvedFlavour): string[] {
  const problems: string[] = [];

  if (!flavour.envFile) {
    problems.push(
      `No env file at "${flavour.config.envFile}" for the ${flavour.environment} flavour. ` +
        "Create it, or point the flavour at another path in .capuchoo/project.json.",
    );
    return problems;
  }

  if (!flavour.fileEnv.VITE_APP_ID) {
    problems.push(`${flavour.config.envFile} does not set VITE_APP_ID`);
  }
  if (!flavour.fileEnv.VITE_UPDATE_API_URL) {
    problems.push(
      `${flavour.config.envFile} does not set VITE_UPDATE_API_URL, so the built app ` +
        "would ship with updates disabled",
    );
  }

  return problems;
}

export interface VersionState {
  /** Semantic version from the app's package.json. */
  version: string;
  versionCode: number;
  codes: VersionCodes;
}

export function readVersionCodes(appDir: string, project: ResolvedProjectConfig): VersionCodes {
  const file = path.resolve(appDir, project.versionCodeFile);
  if (!fs.existsSync(file)) return { ...INITIAL_VERSION_CODES };

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<VersionCodes>;
    return { ...INITIAL_VERSION_CODES, ...parsed };
  } catch {
    throw new Error(
      `${project.versionCodeFile} is not valid JSON. Fix or delete it before deploying.`,
    );
  }
}

export function writeVersionCodes(
  appDir: string,
  project: ResolvedProjectConfig,
  codes: VersionCodes,
): void {
  const file = path.resolve(appDir, project.versionCodeFile);
  fs.writeFileSync(file, `${JSON.stringify(codes, null, 2)}\n`);
}

/**
 * Computes the version state for a deploy.
 *
 * `bumpCode` should be true for a native build - Android refuses an APK whose
 * versionCode did not increase - and false for an OTA bundle, which does not
 * change the installed binary.
 */
export function resolveVersionState(
  appDir: string,
  project: ResolvedProjectConfig,
  environment: Environment,
  version: string,
  bumpCode: boolean,
): VersionState {
  const current = readVersionCodes(appDir, project);
  const codes = bumpCode ? nextVersionCode(current, environment) : current;

  return { version, versionCode: codes[environment], codes };
}

/**
 * The environment a build step runs with: the flavour's own values, plus the
 * resolved version. Version values win, because they are computed for *this*
 * deploy while the file holds whatever the last one left behind.
 */
export function buildEnvironment(
  flavour: ResolvedFlavour,
  state: VersionState,
): Record<string, string> {
  return {
    ...flavour.fileEnv,
    ...versionEnv(state.version, state.versionCode),
  };
}
