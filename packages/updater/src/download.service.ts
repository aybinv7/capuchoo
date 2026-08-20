import type { PluginListenerHandle } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Network } from "@capacitor/network";
import type { ResolvedUpdate } from "@capucho/core";
import { getUpdaterConfig } from "./config.js";

export interface DownloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/** Cache file name prefix, derived from the app id so two flavours never collide. */
function cachePrefix(): string {
  const { appId, appName } = getUpdaterConfig();
  const base = appId || appName;
  return `${base.replaceAll(/[^\w.-]/g, "-")}-`;
}

function apkFileName(update: ResolvedUpdate): string {
  return `${cachePrefix()}${update.version}-${update.versionCode ?? 0}.apk`;
}

/**
 * Downloads a native APK into the app cache and returns its path.
 *
 * The file name embeds the app id, so a staging build and a production build
 * installed side by side cannot overwrite each other's download. The previous
 * implementation prefixed every file with a hard-coded app name.
 */
export async function downloadNativeUpdate(
  update: ResolvedUpdate,
  onProgress: (progress: DownloadProgress) => void,
): Promise<string> {
  if (!update.downloadUrl) {
    throw new Error("This update has no download URL");
  }

  const network = await Network.getStatus();
  if (!network.connected) {
    throw new Error("Connect to the internet to download this update");
  }

  // Clear older APKs first: they are typically 20-60 MB and the OS can evict
  // the cache mid-download if it is already full.
  await cleanApkCache();

  const fileName = apkFileName(update);
  const destination = await Filesystem.getUri({
    directory: Directory.Cache,
    path: fileName,
  });

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

/** Removes this app's cached APKs. Failures are non-fatal. */
export async function cleanApkCache(): Promise<void> {
  const prefix = cachePrefix();

  try {
    const { files } = await Filesystem.readdir({
      directory: Directory.Cache,
      path: "",
    });

    await Promise.all(
      files
        .filter((file) => file.name.startsWith(prefix) && file.name.endsWith(".apk"))
        .map((file) => Filesystem.deleteFile({ directory: Directory.Cache, path: file.name })),
    );
  } catch (error) {
    console.warn("[capucho] could not clean the APK cache", error);
  }
}
