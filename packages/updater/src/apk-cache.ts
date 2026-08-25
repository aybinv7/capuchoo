/**
 * Which downloaded APK to keep, reuse, or throw away.
 *
 * Pure over file names and sizes; `download.service.ts` supplies the filesystem.
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
 * Reads a name produced by `apkFileName`, or null for anything else - the
 * WebView's own files share this directory and the caller deletes what we claim.
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
 * Whether a cached file is the offered update, complete.
 *
 * Size is the check: an interrupted download leaves a partial file at the right
 * path. Without an expected size the file is not trusted.
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
 * Which cached APKs to delete.
 *
 * Without `keep`: only what the installed build number has caught up with, so a
 * newer downloaded-but-uninstalled APK survives. With `keep`: also other pending
 * downloads, to make room. `keep` itself is never deleted.
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
