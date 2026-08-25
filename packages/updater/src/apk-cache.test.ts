/**
 * The cache rules, which decide whether someone pays for 45 MB again.
 *
 * Every case below was reachable on a real device before this module existed,
 * and the first one was reachable twice in a row: pressing update, waiting for
 * the download, then pressing it again re-downloaded the whole binary because
 * the first thing the download did was delete it.
 */

import { describe, expect, it } from "vite-plus/test";
import {
  apkFileName,
  apksToDelete,
  cachePrefix,
  isCompleteDownload,
  parseApkFileName,
  type CachedApk,
} from "./apk-cache.js";

const APP = "com.efficy.app";

describe("file names", () => {
  it("names an APK after the app, version and build", () => {
    expect(apkFileName(APP, { version: "1.0.56", versionCode: 67 })).toBe(
      "com.efficy.app-1.0.56-67.apk",
    );
  });

  // Two flavours installed side by side must not overwrite each other's
  // download; the app id is what separates them.
  it("keeps flavours apart", () => {
    expect(cachePrefix("com.efficy.app")).not.toBe(cachePrefix("com.efficy.app.staging"));
  });

  it("round-trips a name it produced", () => {
    const name = apkFileName(APP, { version: "1.0.56", versionCode: 67 });
    expect(parseApkFileName(APP, name)).toEqual({ version: "1.0.56", versionCode: 67 });
  });

  it("reads a prerelease version, which contains the separator too", () => {
    const name = apkFileName(APP, { version: "2.0.0-beta.1", versionCode: 80 });
    expect(parseApkFileName(APP, name)).toEqual({ version: "2.0.0-beta.1", versionCode: 80 });
  });

  /**
   * The cache directory is shared with the WebView's own storage. Anything not
   * recognisably ours must parse to null, because the caller deletes what this
   * returns.
   */
  it.each([
    ["another app's download", "com.other.app-1.0.0-5.apk"],
    ["a WebView file", "webview_cache_0001"],
    ["no build number", "com.efficy.app-1.0.56.apk"],
    ["not an apk", "com.efficy.app-1.0.56-67.zip"],
  ])("refuses to claim %s", (_label, fileName) => {
    expect(parseApkFileName(APP, fileName)).toBeNull();
  });
});

describe("reusing a download", () => {
  it("reuses a file whose size matches what the server published", () => {
    expect(isCompleteDownload({ size: 47_464_813 }, 47_464_813)).toBe(true);
  });

  /**
   * A connection dropped mid-download leaves a partial file at the right path.
   * Handing that to the Android installer fails with "There was a problem
   * parsing the package", which says nothing about the real cause.
   */
  it("rejects a truncated file", () => {
    expect(isCompleteDownload({ size: 12_000_000 }, 47_464_813)).toBe(false);
  });

  it("rejects a file that is somehow larger than published", () => {
    expect(isCompleteDownload({ size: 50_000_000 }, 47_464_813)).toBe(false);
  });

  it("does not exist yet", () => {
    expect(isCompleteDownload(null, 47_464_813)).toBe(false);
  });

  // file_size was declared on the contract and never populated until the server
  // learned to map file_size_bytes onto it, so older servers send nothing.
  it("will not trust a file it cannot verify", () => {
    expect(isCompleteDownload({ size: 47_464_813 }, undefined)).toBe(false);
  });
});

describe("what to delete", () => {
  const cached: CachedApk[] = [
    { fileName: "com.efficy.app-1.0.52-61.apk", version: "1.0.52", versionCode: 61 },
    { fileName: "com.efficy.app-1.0.56-67.apk", version: "1.0.56", versionCode: 67 },
    { fileName: "com.efficy.app-2.0.0-90.apk", version: "2.0.0", versionCode: 90 },
  ];

  /**
   * The bug this whole module exists for: the download used to delete every APK
   * for this app as its first step, including the one it was about to write.
   */
  it("never deletes the file it is about to download", () => {
    const deleted = apksToDelete({
      cached,
      installedVersionCode: 61,
      keep: "com.efficy.app-1.0.56-67.apk",
    });

    expect(deleted).not.toContain("com.efficy.app-1.0.56-67.apk");
  });

  it("clears everything else to make room for it", () => {
    expect(
      apksToDelete({ cached, installedVersionCode: 61, keep: "com.efficy.app-1.0.56-67.apk" }),
    ).toEqual(["com.efficy.app-1.0.52-61.apk", "com.efficy.app-2.0.0-90.apk"]);
  });

  /**
   * How an installed APK is finally cleaned up. There is no callback from the
   * Android installer, but the next launch reports a higher build number, and
   * that says the same thing.
   */
  it("removes an APK the device has already installed", () => {
    expect(apksToDelete({ cached, installedVersionCode: 67 })).toEqual([
      "com.efficy.app-1.0.52-61.apk",
      "com.efficy.app-1.0.56-67.apk",
    ]);
  });

  // Downloaded, not yet installed. Deleting it means paying for it twice.
  it("keeps an update that is downloaded and still waiting", () => {
    expect(apksToDelete({ cached, installedVersionCode: 67 })).not.toContain(
      "com.efficy.app-2.0.0-90.apk",
    );
  });

  it("has nothing to do when the cache is empty", () => {
    expect(apksToDelete({ cached: [], installedVersionCode: 67 })).toEqual([]);
  });
});
