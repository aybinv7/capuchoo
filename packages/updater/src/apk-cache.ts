/**
 * Which downloaded APK to keep, reuse, or throw away.
 *
 * A native binary is 40-60 MB and users pay for it, sometimes on mobile data.
 * The previous implementation spent that repeatedly and needlessly:
 *
 *   - `downloadNativeUpdate` called `cleanApkCache()` as its first step, which
 *     deleted every APK for this app - including the exact file it was about to
 *     fetch. A second press always re-downloaded.
 *   - The only record that a download had finished was `state.cachedPath`, in
 *     memory. Closing the app threw it away, so the next launch downloaded the
 *     same bytes again while the file sat on disk.
 *   - Nothing ever deleted a successfully installed APK, so it stayed in the
 *     cache forever.
 *
 * The decisions are here, as pure functions over file names and sizes, because
 * the alternative is discovering the behaviour on a phone with a data plan.
 * `download.service.ts` supplies the filesystem.
 */

/** Cache file name prefix, derived from the app id so two flavours never collide. */
export function cachePrefix(appId: string): string {
  return `${appId.replaceAll(/[^\w.-]/g, "-")}-`;
}

export interface ApkIdentity {
  version: string;
  versionCode: number;
}

/** `com.efficy.app-1.0.56-67.apk` */
export function apkFileName(appId: string, update: ApkIdentity): string {
  return `${cachePrefix(appId)}${update.version}-${update.versionCode}.apk`;
}

/**
 * Reads a name produced by `apkFileName` back into what it holds.
 *
 * Returns null for anything else in the cache directory - the WebView's own
 * files live there too, and deleting one of those would be a very expensive
 * mistake to make with a regex.
 */
export function parseApkFileName(appId: string, fileName: string): ApkIdentity | null {
  const prefix = cachePrefix(appId);
  if (!fileName.startsWith(prefix) || !fileName.endsWith(".apk")) return null;

  const middle = fileName.slice(prefix.length, -".apk".length);
  const match = /^(.+)-(\d+)$/.exec(middle);
  if (!match) return null;

  return { version: match[1]!, versionCode: Number(match[2]) };
}

/**
 * Whether a cached file is the update being offered, complete.
 *
 * Size is the check. A download interrupted by a dead connection leaves a
 * partial file at the right path, and reusing that hands the Android installer
 * a truncated APK - which fails with "There was a problem parsing the package",
 * a message that says nothing about the real cause.
 *
 * When the server did not send a size there is nothing to verify against, so
 * the file is not trusted. Re-downloading costs bandwidth; installing a
 * truncated binary costs a support call.
 */
export function isCompleteDownload(
  cached: { size: number } | null,
  expectedSize: number | undefined,
): boolean {
  if (!cached || !expectedSize) return false;
  return cached.size === expectedSize;
}

export interface CachedApk extends ApkIdentity {
  fileName: string;
}

/**
 * Which cached APKs to delete, given what is installed and what is wanted.
 *
 * Two situations, deliberately one function because they differ by one rule:
 *
 * **Pruning** (no `keep`) removes only what the device has outgrown - anything
 * whose build number the installed binary has caught up with. That is how an
 * installed APK finally gets deleted: the Android installer never calls back,
 * but the next launch reports a higher build number, which says the same thing.
 * A *newer* APK is left alone, because it is an update already downloaded and
 * waiting to be installed, and throwing it away would mean paying for it twice.
 *
 * **Making room** (`keep` given) additionally removes other pending downloads,
 * because the file about to be written is tens of megabytes and the OS will
 * evict from a full cache mid-download.
 *
 * `keep` itself is never deleted. Deleting the file that is about to be
 * downloaded is the exact bug this module exists to prevent.
 */
export function apksToDelete(input: {
  cached: CachedApk[];
  installedVersionCode: number;
  keep?: string | undefined;
}): string[] {
  const { cached, installedVersionCode, keep } = input;
  const makingRoom = keep !== undefined;

  return cached
    .filter((apk) => {
      if (apk.fileName === keep) return false;
      if (apk.versionCode <= installedVersionCode) return true;
      return makingRoom;
    })
    .map((apk) => apk.fileName);
}
