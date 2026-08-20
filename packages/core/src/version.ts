import type { Environment } from "./update-contract.js";

/**
 * Version arithmetic, kept free of any filesystem or child-process access so
 * both the CLI and the tests can use it directly.
 *
 * The CLI used to shell out to `npm version <type> --no-git-tag-version` for
 * this. In a workspace that is actively wrong: npm resolves the *nearest*
 * package.json, so running it from a monorepo root bumped the root package
 * instead of the app, and it mixed npm into a pnpm/Vite+ project for a job
 * that is three lines of string handling.
 */

export type BumpType = "major" | "minor" | "patch";

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

const SEMVER =
  /^(\d+)\.(\d+)\.(\d+)(?:-([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/;

export function parseVersion(value: string): SemanticVersion | null {
  const match = SEMVER.exec(value.trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4],
    build: match[5],
  };
}

export function formatVersion(version: SemanticVersion): string {
  let out = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease) out += `-${version.prerelease}`;
  if (version.build) out += `+${version.build}`;
  return out;
}

/**
 * Bumps a version string. Prerelease and build metadata are dropped, matching
 * `npm version` semantics for a plain major/minor/patch bump.
 */
export function bumpVersion(value: string, type: BumpType): string {
  const parsed = parseVersion(value);
  if (!parsed) {
    throw new Error(`"${value}" is not a semantic version, so it cannot be bumped`);
  }

  switch (type) {
    case "major":
      return formatVersion({ major: parsed.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor + 1,
        patch: 0,
      });
    case "patch":
      return formatVersion({
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch + 1,
      });
  }
}

/**
 * Compares two semantic versions. Returns a negative number when `a` is older.
 *
 * A missing or unparseable version sorts oldest, which is what the app needs:
 * the sentinel `"builtin"` must always look older than any published bundle.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);

  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;

  // 1.0.0-beta precedes 1.0.0.
  if (left.prerelease && !right.prerelease) return -1;
  if (!left.prerelease && right.prerelease) return 1;
  if (left.prerelease && right.prerelease) {
    return left.prerelease < right.prerelease ? -1 : left.prerelease > right.prerelease ? 1 : 0;
  }

  return 0;
}

export type VersionCodes = Record<Environment, number>;

export const INITIAL_VERSION_CODES: VersionCodes = {
  dev: 1,
  staging: 1,
  prod: 1,
};

/**
 * Native build numbers must increase monotonically per environment: Android
 * refuses to install an APK whose versionCode is not greater than the
 * installed one, and the backend uses the same number to decide whether a
 * native update supersedes an OTA bundle.
 */
export function nextVersionCode(
  codes: Partial<VersionCodes> | null | undefined,
  environment: Environment,
): VersionCodes {
  const current: VersionCodes = { ...INITIAL_VERSION_CODES, ...codes };
  return { ...current, [environment]: (current[environment] ?? 0) + 1 };
}

/**
 * Build-time variables injected into the web build and the native
 * configuration step.
 *
 * These used to be written *into* the committed `build/<env>/.env.<env>` file
 * by every deploy, which dirtied the working tree and made two concurrent
 * deploys race over one file. They are environment variables now: Trapeze
 * reads its `vars:` block from the process environment, and Vite reads
 * `VITE_*` the same way.
 */
export function versionEnv(version: string, versionCode: number) {
  return {
    VITE_APP_VERSION: version,
    VERSION_CODE: String(versionCode),
    BUILD_NUMBER: String(versionCode),
  };
}
