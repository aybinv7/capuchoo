import type { PluginListenerHandle } from "@capacitor/core";
import type { ResolvedUpdate } from "@capuchoo/core";
import {
  apkFileName,
  apksToDelete,
  isCompleteDownload,
  parseApkFileName,
  type CachedApk,
} from "./apk-cache.js";
import { getUpdaterConfig } from "./config.js";
import { nativePlugins } from "./optional-plugins.js";

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

const DONE = { loaded: 0, total: 0, percent: 100 };

function fileNameFor(update: ResolvedUpdate): string {
  const { appId, appName } = getUpdaterConfig();
  return apkFileName(appId || appName, {
    version: update.version,
    versionCode: update.versionCode ?? 0,
  });
}

/** Every APK in the cache that belongs to this app. */
async function listCachedApks(): Promise<CachedApk[]> {
  const { appId, appName } = getUpdaterConfig();
  const owner = appId || appName;

  try {
    const { Directory, Filesystem } = await nativePlugins.filesystem();
    const { files } = await Filesystem.readdir({ directory: Directory.Cache, path: "" });

    return files.flatMap((file) => {
      const identity = parseApkFileName(owner, file.name);
      return identity ? [{ ...identity, fileName: file.name }] : [];
    });
  } catch {
    // A cache we cannot read is a cache we cannot reuse or prune, and neither
    // is worth failing an update over.
    return [];
  }
}

/**
 * The path of an already-downloaded, complete copy of this update.
 *
 * The only record that a download had finished used to be an in-memory
 * `cachedPath`, so closing the app threw it away and the next launch downloaded
 * the same 45 MB again while the file sat on disk. Asking the filesystem
 * survives a restart.
 */
export async function findCachedApk(update: ResolvedUpdate): Promise<string | null> {
  const fileName = fileNameFor(update);

  try {
    const { Directory, Filesystem } = await nativePlugins.filesystem();

    const stat = await Filesystem.stat({ directory: Directory.Cache, path: fileName });
    if (!isCompleteDownload({ size: stat.size }, update.fileSize)) return null;

    const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
    return uri;
  } catch {
    // stat throws when the file is not there, which is the common case.
    return null;
  }
}

/**
 * Downloads a native APK into the app cache and returns its path.
 *
 * Returns immediately when a complete copy is already there. The previous
 * implementation could not: its first step was `cleanApkCache()`, which deleted
 * every APK for this app - including the exact file it was about to fetch - so
 * pressing update twice always paid for the binary twice.
 */
export async function downloadNativeUpdate(
  update: ResolvedUpdate,
  onProgress: (progress: DownloadProgress) => void,
): Promise<string> {
  if (!update.downloadUrl) {
    throw new Error("This update has no download URL");
  }

  const existing = await findCachedApk(update);
  if (existing) {
    onProgress({ ...DONE });
    return existing;
  }

  const { Network } = await nativePlugins.network();
  const network = await Network.getStatus();
  if (!network.connected) {
    throw new Error("Connect to the internet to download this update");
  }

  const fileName = fileNameFor(update);

  // Make room, but never for the file being written. APKs are tens of megabytes
  // and the OS can evict from a full cache mid-download.
  await pruneApkCache({ installedVersionCode: 0, keep: fileName });

  const [{ Directory, Filesystem }, { FileTransfer }] = await Promise.all([
    nativePlugins.filesystem(),
    nativePlugins.fileTransfer(),
  ]);

  const destination = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });

  let progressListener: PluginListenerHandle | null = null;

  try {
    progressListener = await FileTransfer.addListener("progress", (event) => {
      if (event.url !== update.downloadUrl) return;

      const percent =
        event.lengthComputable && event.contentLength > 0
          ? Math.round((event.bytes / event.contentLength) * 100)
          : 0;
      onProgress({ loaded: event.bytes, total: event.contentLength, percent });
    });

    const result = await FileTransfer.downloadFile({
      url: update.downloadUrl,
      path: destination.uri,
      progress: true,
      connectTimeout: 60_000,
      readTimeout: 300_000,
    });

    return result.path || destination.uri;
  } finally {
    await progressListener?.remove();
  }
}

/**
 * Deletes cached APKs the device has outgrown.
 *
 * Called on start-up with the installed build number, which is how an installed
 * APK is finally cleaned up: the Android installer never calls back, but the
 * next launch reports a higher build number and that says the same thing. A
 * *newer* APK is kept - it is an update already paid for and waiting to be
 * installed.
 *
 * Failures are non-fatal. Reclaiming disk space must never break an update.
 */
export async function pruneApkCache(options: {
  installedVersionCode: number;
  keep?: string | undefined;
}): Promise<string[]> {
  try {
    const cached = await listCachedApks();
    const doomed = apksToDelete({ cached, ...options });
    if (doomed.length === 0) return [];

    const { Directory, Filesystem } = await nativePlugins.filesystem();
    await Promise.all(
      doomed.map((fileName) =>
        Filesystem.deleteFile({ directory: Directory.Cache, path: fileName }),
      ),
    );

    return doomed;
  } catch (error) {
    console.warn("[capuchoo] could not prune the APK cache", error);
    return [];
  }
}
