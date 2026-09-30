import type { ResolvedUpdate } from "@capuchoo/core";
import { mergeUpdate, type MergeResult, type UpdateSource } from "../update-merge.js";
import { NO_PROGRESS, isBusy, state } from "./updater-state.js";

let resolvedAt = 0;
let verifiedPath: string | null = null;

/**
 * Puts an update on offer, through `mergeUpdate`: the same artefact keeps its
 * download progress, cached APK and installer state; a different one resets
 * them; nothing replaces an artefact that is mid-flight.
 */
export function publishUpdate(
  incoming: ResolvedUpdate,
  source: UpdateSource,
): MergeResult["action"] {
  const result = mergeUpdate({
    current: state.value.currentUpdate,
    incoming,
    source,
    busy: isBusy(),
  });
  if (result.action === "ignore") return "ignore";

  if (source === "server") resolvedAt = Date.now();

  state.value.currentUpdate = result.update;
  state.value.updateAvailable = true;
  state.value.lastCheckMessage = `Version ${result.update.version} is available`;

  if (result.action === "replace") {
    state.value.cachedPath = null;
    state.value.handedToInstaller = false;
    state.value.progress = { ...NO_PROGRESS };
    state.value.error = null;
    state.value.installFailures = 0;
    state.value.installAbandoned = false;
    verifiedPath = null;
  }

  return result.action;
}

/** Takes the pending update off offer. */
export function withdrawUpdate(): void {
  state.value.updateAvailable = false;
  state.value.currentUpdate = null;
  state.value.cachedPath = null;
  state.value.statusMessage = "";
  state.value.progress = { ...NO_PROGRESS };
  state.value.installFailures = 0;
  state.value.installAbandoned = false;
  verifiedPath = null;
}

/** Milliseconds since the server last described the current update, and its download link. */
export function updateAge(now: number = Date.now()): number {
  return resolvedAt === 0 ? Number.POSITIVE_INFINITY : now - resolvedAt;
}

/** Whether this APK path has already passed signature and checksum verification. */
export function isVerifiedPath(path: string): boolean {
  return verifiedPath === path;
}

export function markVerifiedPath(path: string | null): void {
  verifiedPath = path;
}

/** @internal test hook. */
export function __resetPublishState(): void {
  resolvedAt = 0;
  verifiedPath = null;
}
