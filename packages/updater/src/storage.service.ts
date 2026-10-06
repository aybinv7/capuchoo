import { CapacitorUpdater } from "@capgo/capacitor-updater";
import {
  bundlesToDelete,
  isDownloading,
  type BundleOffer,
  type StoredBundle,
} from "./bundle-retention.js";
import { DELTA_CACHE_DIRECTORY, deltaCacheEntriesToDelete } from "./delta-cache.js";
import { isNative } from "./device.js";
import { nativePlugins } from "./optional-plugins.js";

export interface ReclaimResult {
  deletedBundles: string[];
  deletedCacheEntries: number;
  skipped?: "not-native" | "unconfirmed" | "unknown-state" | "downloading";
}

let running: Promise<ReclaimResult> | null = null;

interface PluginSnapshot {
  bundles: StoredBundle[];
  currentId: string;
  nextId: string | null;
  confirmed: boolean;
}

async function snapshot(): Promise<PluginSnapshot | null> {
  try {
    const [{ bundles }, current, next] = await Promise.all([
      CapacitorUpdater.list({ raw: true }),
      CapacitorUpdater.current(),
      CapacitorUpdater.getNextBundle(),
    ]);
    return {
      bundles,
      currentId: current.bundle.id,
      nextId: next?.id ?? null,
      confirmed: current.bundle.status === "success",
    };
  } catch (error) {
    console.warn("[capuchoo] could not read the stored bundles", error);
    return null;
  }
}

async function deleteBundles(ids: readonly string[]): Promise<string[]> {
  const deleted: string[] = [];
  for (const id of ids) {
    try {
      await CapacitorUpdater.delete({ id });
      deleted.push(id);
    } catch (error) {
      console.warn("[capuchoo] could not delete bundle", id, error);
    }
  }
  return deleted;
}

async function clearDeltaCache(): Promise<number> {
  let filesystem: Awaited<ReturnType<typeof nativePlugins.filesystem>>;
  try {
    filesystem = await nativePlugins.filesystem();
  } catch {
    return 0;
  }

  const { Directory, Filesystem } = filesystem;
  let names: string[];
  try {
    const { files } = await Filesystem.readdir({
      directory: Directory.Cache,
      path: DELTA_CACHE_DIRECTORY,
    });
    names = files.filter((file) => file.type !== "directory").map((file) => file.name);
  } catch {
    return 0;
  }

  const results = await Promise.allSettled(
    deltaCacheEntriesToDelete(names).map((name) =>
      Filesystem.deleteFile({
        directory: Directory.Cache,
        path: `${DELTA_CACHE_DIRECTORY}/${name}`,
      }),
    ),
  );
  return results.filter((result) => result.status === "fulfilled").length;
}

async function reclaim(offer: BundleOffer | null): Promise<ReclaimResult> {
  const state = await snapshot();
  if (!state) return { deletedBundles: [], deletedCacheEntries: 0, skipped: "unknown-state" };
  if (!state.confirmed) {
    return { deletedBundles: [], deletedCacheEntries: 0, skipped: "unconfirmed" };
  }

  const deletedBundles = await deleteBundles(
    bundlesToDelete({
      bundles: state.bundles,
      currentId: state.currentId,
      nextId: state.nextId,
      offer,
    }),
  );

  if (isDownloading(state.bundles)) {
    return { deletedBundles, deletedCacheEntries: 0, skipped: "downloading" };
  }
  return { deletedBundles, deletedCacheEntries: await clearDeltaCache() };
}

/**
 * Deletes the OTA bundles and delta-cache copies nothing will use again.
 *
 * Call only once the server has answered a check, with the OTA update the app
 * may still apply - `offer` is what keeps a downloaded, not-yet-accepted
 * required update on disk. Does nothing until the running bundle is confirmed
 * by `notifyAppReady`, and leaves the delta cache alone while any bundle is
 * downloading. Bundles go through the plugin's own `delete`, which also refuses
 * the running and next bundles.
 *
 * A call while one is running returns that run's result rather than queueing.
 */
export function reclaimUpdateStorage(offer: BundleOffer | null): Promise<ReclaimResult> {
  if (!isNative()) {
    return Promise.resolve({ deletedBundles: [], deletedCacheEntries: 0, skipped: "not-native" });
  }
  running ??= reclaim(offer).finally(() => {
    running = null;
  });
  return running;
}
