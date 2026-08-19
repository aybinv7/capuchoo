import { CapacitorUpdater } from "@capgo/capacitor-updater";
import type { ResolvedUpdate } from "@capucho/core";
import { isNative } from "./device.js";

/**
 * Thin wrapper over the OTA plugin.
 *
 * Downloading and applying a web bundle stays with `@capgo/capacitor-updater`:
 * it owns the native bundle store, the atomic swap and the rollback. This
 * module only sequences those calls correctly.
 */

/**
 * Confirms the current bundle booted successfully.
 *
 * **This must be called once, early, on every app start.** If the plugin does
 * not hear it within `appReadyTimeout`, it assumes the new bundle crashed and
 * rolls back to the previous one - which looks exactly like "the update did
 * not install".
 */
export async function notifyAppReady(): Promise<void> {
  if (!isNative()) return;

  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error) {
    console.warn("[capucho] could not mark this bundle as ready", error);
  }
}

/** The bundle currently applied, or null off-device. */
export async function getCurrentBundle() {
  if (!isNative()) return null;

  try {
    return await CapacitorUpdater.current();
  } catch (error) {
    console.warn("[capucho] could not read the current bundle", error);
    return null;
  }
}

/**
 * Downloads an OTA bundle and applies it.
 *
 * `set` swaps the active bundle and reloads the WebView, so nothing after it
 * runs. It is called last on purpose.
 */
export async function applyOtaUpdate(update: ResolvedUpdate): Promise<void> {
  if (update.kind !== "ota") {
    throw new Error("applyOtaUpdate was given a native update");
  }

  // Already downloaded - either by a previous attempt in this session, or by
  // the plugin's own background download when autoUpdate is "onlyDownload".
  if (update.bundleId) {
    await CapacitorUpdater.set({ id: update.bundleId });
    return;
  }

  if (!update.downloadUrl) {
    throw new Error("This update has no download URL");
  }

  const bundle = await CapacitorUpdater.download({
    url: update.downloadUrl,
    version: update.version,
    ...(update.checksum ? { checksum: update.checksum } : {}),
    ...(update.sessionKey ? { sessionKey: update.sessionKey } : {}),
  });

  update.bundleId = bundle.id;
  await CapacitorUpdater.set({ id: bundle.id });
}

/** Discards a downloaded bundle that will not be applied. */
export async function discardBundle(bundleId: string): Promise<void> {
  if (!isNative()) return;

  try {
    await CapacitorUpdater.delete({ id: bundleId });
  } catch (error) {
    console.warn("[capucho] could not delete bundle", bundleId, error);
  }
}
