import {
  bumpVersion,
  parseVersion,
  type BumpType,
  type Environment,
  type Platform,
} from "@capuchoo/core";
import type { AppArtefacts } from "../services/wire.js";

/** What `-v` accepts: a semantic bump, `auto`, or an exact version such as a tag's. */
export type VersionRequest = BumpType | "auto" | (string & {});

const BUMPS: readonly string[] = ["major", "minor", "patch"];
const KEYWORDS: readonly string[] = [...BUMPS, "auto"];

const isBump = (request: string): request is BumpType => BUMPS.includes(request);

/** Null when `-v` is usable, else why not. A leading `v`, as in a git tag, is accepted. */
export function describeVersionRequestProblem(request: string): string | null {
  if (KEYWORDS.includes(request) || parseVersion(request.replace(/^v/, ""))) return null;
  return `-v takes major, minor, patch, auto or a version such as 1.2.3; "${request}" is none of them`;
}

/**
 * A prerelease of the next patch, numbered after the highest one already published:
 * `0.1.10` on dev becomes `0.1.11-dev.1`, then `0.1.11-dev.2`. It sorts above what devices run
 * and below the `0.1.11` a prod release will take, so a CI build never claims a real version.
 */
export function nextPrerelease(
  current: string,
  environment: Environment,
  published: readonly string[],
): string {
  const prefix = `${bumpVersion(current, "patch")}-${environment}.`;
  const highest = published
    .filter((version) => version.startsWith(prefix))
    .map((version) => Number(version.slice(prefix.length)))
    .filter((number) => Number.isInteger(number) && number > 0)
    .reduce((max, number) => Math.max(max, number), 0);
  return `${prefix}${highest + 1}`;
}

export interface VersionResolution {
  version: string;
  /** Shown beside the version, e.g. "patch from 0.1.10". */
  origin: string | null;
}

/**
 * `auto` publishes prod exactly as package.json says - a prod version is a decision, made in a
 * commit - and gives dev and staging a prerelease that needs no commit at all.
 */
export function resolveReleaseVersion(input: {
  current: string;
  request: VersionRequest | undefined;
  environment: Environment;
  published: readonly string[];
}): VersionResolution {
  const { current, request, environment } = input;
  if (!request) return { version: current, origin: null };
  if (isBump(request))
    return { version: bumpVersion(current, request), origin: `${request} from ${current}` };
  if (request !== "auto") return { version: request.replace(/^v/, ""), origin: "given" };
  if (environment === "prod") return { version: current, origin: "package.json" };
  return {
    version: nextPrerelease(current, environment, input.published),
    origin: `next ${environment} build after ${current}`,
  };
}

/** Bundle versions the server already holds for this platform; they are unique per app. */
export function publishedBundleVersions(
  artefacts: AppArtefacts | null,
  platform: Platform,
): string[] {
  return (artefacts?.bundles ?? [])
    .filter((bundle) => bundle.platform === platform)
    .map((bundle) => bundle.version_name);
}

/** The build number after the highest the server holds for this flavour, or 1. */
export function nextPublishedCode(
  artefacts: AppArtefacts | null,
  platform: Platform,
  environment: Environment,
): number {
  const codes = (artefacts?.native_builds ?? [])
    .filter((build) => build.platform === platform && build.flavour === environment)
    .map((build) => build.version_code);
  return codes.length === 0 ? 1 : Math.max(...codes) + 1;
}

/** Refused before building: the upload would end in a conflict after the whole build. */
export function describeTakenVersion(input: {
  kind: "ota" | "native";
  version: string;
  platform: Platform;
  environment: Environment;
  artefacts: AppArtefacts | null;
}): string | null {
  if (input.kind !== "ota") return null;
  if (!publishedBundleVersions(input.artefacts, input.platform).includes(input.version))
    return null;
  const hint =
    input.environment === "prod"
      ? "Raise the version in package.json, or pass -v patch"
      : "Pass -v auto to publish the next prerelease, or raise the version in package.json";
  return `Version ${input.version} is already published for ${input.platform}. ${hint}.`;
}
