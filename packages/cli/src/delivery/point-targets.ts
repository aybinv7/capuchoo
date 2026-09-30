import type { Environment, Platform } from "@capuchoo/core";
import type { AppArtefacts, BundleArtefact, NativeArtefact } from "../services/wire.js";

export interface PointRequest {
  artefacts: AppArtefacts;
  channel: { name: string; environment: Environment };
  platform: Platform;
  version: string;
  /** `--native`: the native build number to point at alongside, or instead of, the bundle. */
  nativeCode?: number | undefined;
}

export interface PointTargets {
  bundle: BundleArtefact | null;
  native: NativeArtefact | null;
}

function pickFlavour<T extends { flavour: Environment | null }>(
  candidates: T[],
  environment: Environment,
  describe: () => string,
): T | null {
  if (candidates.length === 0) return null;
  const match = candidates.find((candidate) => candidate.flavour === environment);
  if (match) return match;
  const flavours = [...new Set(candidates.map((candidate) => candidate.flavour ?? "no flavour"))];
  throw new Error(
    `${describe()} exists only for the ${flavours.join(", ")} flavour, and the channel serves ${environment}. ` +
      "Build and publish it from the right flavour first.",
  );
}

function latest(values: string[], limit = 5): string {
  return values.slice(0, limit).join(", ") || "none";
}

/**
 * The artefacts `channel point` moves the pointers to. `--version` selects the OTA bundle; with
 * `--native` it may also be a native release's version, in which case only the native pointer
 * moves. Throws with what does exist when nothing matches.
 */
export function selectPointTargets(request: PointRequest): PointTargets {
  const { artefacts, channel, platform, version, nativeCode } = request;
  const environment = channel.environment;

  const bundle = pickFlavour(
    artefacts.bundles.filter((row) => row.platform === platform && row.version_name === version),
    environment,
    () => `Bundle ${version}`,
  );

  let native: NativeArtefact | null = null;
  if (nativeCode !== undefined) {
    native = pickFlavour(
      artefacts.native_builds.filter(
        (row) => row.platform === platform && row.version_code === nativeCode,
      ),
      environment,
      () => `Native build ${nativeCode}`,
    );

    if (!native) {
      const codes = artefacts.native_builds
        .filter((row) => row.platform === platform && row.flavour === environment)
        .sort((a, b) => b.version_code - a.version_code)
        .map((row) => `${row.version_code} (${row.version_name})`);
      throw new Error(
        `No ${platform} native build ${nativeCode} for ${environment}. Newest: ${latest(codes)}.`,
      );
    }

    if (native.version_name !== version) {
      throw new Error(
        `Native build ${nativeCode} is version ${native.version_name}, not ${version}. Pass --version ${native.version_name}.`,
      );
    }
  }

  if (!bundle && !native) {
    const versions = artefacts.bundles
      .filter((row) => row.platform === platform && row.flavour === environment)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((row) => row.version_name);
    throw new Error(
      `No ${platform} bundle ${version} for ${environment}. Newest: ${latest(versions)}. ` +
        "For a native release, pass --native <versionCode>.",
    );
  }

  return { bundle, native };
}

/** Channels the chosen artefacts may be pointed at, when the server listed them. */
export function eligibleChannels(targets: PointTargets): string[] | null {
  const lists = [targets.bundle, targets.native]
    .filter((row): row is BundleArtefact | NativeArtefact => row !== null)
    .map((row) => row.eligible_channels)
    .filter((list): list is string[] => Array.isArray(list));
  if (lists.length === 0) return null;
  return lists.reduce((shared, list) => shared.filter((name) => list.includes(name)));
}
