/**
 * Which stored bundles survive a prune.
 *
 * Measured on a distributor phone after ~15 OTA deploys in one day: eight
 * bundle folders of ~3.9 MB with only one in use, several `pending` and one
 * `success` - and, straight after a clean reinstall plus one OTA, the same
 * version stored twice, once `pending` and once `success`.
 */

import { describe, expect, it } from "vite-plus/test";
import {
  DOWNLOAD_STALE_MS,
  bundlesToDelete,
  isDownloading,
  reusableBundle,
  type StoredBundle,
} from "./bundle-retention.js";

const CHECKSUM_A = "a".repeat(64);
const CHECKSUM_B = "b".repeat(64);

function bundle(
  id: string,
  version: string,
  status: StoredBundle["status"],
  overrides: Partial<StoredBundle> = {},
): StoredBundle {
  return {
    id,
    version,
    status,
    checksum: CHECKSUM_A,
    downloaded: "2026-10-06T10:00:00.000+0000",
    ...overrides,
  };
}

describe("bundlesToDelete", () => {
  it("deletes the pending duplicate of the running version", () => {
    const bundles = [
      bundle("pendingCopy", "0.2.4-dev.15", "pending"),
      bundle("runningOne", "0.2.4-dev.15", "success"),
    ];

    expect(bundlesToDelete({ bundles, currentId: "runningOne", offer: null })).toEqual([
      "pendingCopy",
    ]);
  });

  it("deletes a day of superseded downloads, keeping only what runs", () => {
    const bundles = [
      bundle("v10", "0.2.4-dev.10", "pending"),
      bundle("v11", "0.2.4-dev.11", "pending"),
      bundle("v12", "0.2.4-dev.12", "success"),
      bundle("v13", "0.2.4-dev.13", "pending"),
      bundle("v14", "0.2.4-dev.14", "error"),
      bundle("v15", "0.2.4-dev.15", "success"),
    ];

    expect(bundlesToDelete({ bundles, currentId: "v15", offer: null })).toEqual([
      "v10",
      "v11",
      "v12",
      "v13",
      "v14",
    ]);
  });

  /**
   * In "onlyDownload" the plugin never sets a next bundle, so a required update
   * the user has not accepted yet is only protected by being on offer.
   */
  it("keeps the downloaded update waiting for the user", () => {
    const bundles = [
      bundle("running", "1.0.0", "success"),
      bundle("waiting", "1.0.1", "pending"),
      bundle("older", "1.0.0-rc.1", "pending"),
    ];

    expect(
      bundlesToDelete({
        bundles,
        currentId: "running",
        offer: { version: "1.0.1", checksum: CHECKSUM_A },
      }),
    ).toEqual(["older"]);
  });

  it("keeps only one copy of the offered version, preferring the bound one", () => {
    const bundles = [
      bundle("running", "1.0.0", "success"),
      bundle("pluginCopy", "1.0.1", "pending", { downloaded: "2026-10-06T11:00:00.000+0000" }),
      bundle("appCopy", "1.0.1", "pending", { downloaded: "2026-10-06T09:00:00.000+0000" }),
    ];

    expect(
      bundlesToDelete({
        bundles,
        currentId: "running",
        offer: { version: "1.0.1", bundleId: "appCopy", checksum: CHECKSUM_A },
      }),
    ).toEqual(["pluginCopy"]);
  });

  it("keeps the newest copy of the offered version when none is bound", () => {
    const bundles = [
      bundle("running", "1.0.0", "success"),
      bundle("first", "1.0.1", "pending", { downloaded: "2026-10-06T09:00:00.000+0000" }),
      bundle("second", "1.0.1", "pending", { downloaded: "2026-10-06T11:00:00.000+0000" }),
    ];

    expect(bundlesToDelete({ bundles, currentId: "running", offer: { version: "1.0.1" } })).toEqual(
      ["first"],
    );
  });

  it("does not keep a copy whose checksum is not the offered release", () => {
    const bundles = [
      bundle("running", "1.0.0", "success"),
      bundle("stale", "1.0.1", "pending", { checksum: CHECKSUM_B }),
    ];

    expect(
      bundlesToDelete({
        bundles,
        currentId: "running",
        offer: { version: "1.0.1", checksum: CHECKSUM_A },
      }),
    ).toEqual(["stale"]);
  });

  it("matches checksums regardless of case", () => {
    const bundles = [
      bundle("running", "1.0.0", "success"),
      bundle("waiting", "1.0.1", "pending", { checksum: CHECKSUM_A.toUpperCase() }),
    ];

    expect(
      bundlesToDelete({
        bundles,
        currentId: "running",
        offer: { version: "1.0.1", checksum: CHECKSUM_A },
      }),
    ).toEqual([]);
  });

  it("keeps no extra copy when the running bundle is already the offered version", () => {
    const bundles = [
      bundle("running", "1.0.1", "success"),
      bundle("duplicate", "1.0.1", "pending"),
    ];

    expect(bundlesToDelete({ bundles, currentId: "running", offer: { version: "1.0.1" } })).toEqual(
      ["duplicate"],
    );
  });

  it("never deletes the next bundle", () => {
    const bundles = [bundle("running", "1.0.0", "success"), bundle("next", "1.0.1", "pending")];

    expect(bundlesToDelete({ bundles, currentId: "running", nextId: "next", offer: null })).toEqual(
      [],
    );
  });

  it("never deletes the builtin, even if listed", () => {
    const bundles = [bundle("builtin", "1.0.0", "success"), bundle("old", "0.9.0", "pending")];

    expect(bundlesToDelete({ bundles, currentId: "builtin", offer: null })).toEqual(["old"]);
  });

  it.each(["downloading", "deleting", "deleted", "something-new"] as const)(
    "leaves a %s bundle to the plugin",
    (status) => {
      const bundles = [bundle("running", "1.0.0", "success"), bundle("busy", "1.0.1", status)];

      expect(bundlesToDelete({ bundles, currentId: "running", offer: null })).toEqual([]);
    },
  );

  it("deletes downloaded OTA bundles when a native update is all that is on offer", () => {
    const bundles = [bundle("running", "1.0.0", "success"), bundle("ota", "1.0.1", "pending")];

    expect(bundlesToDelete({ bundles, currentId: "running", offer: null })).toEqual(["ota"]);
  });
});

describe("reusableBundle", () => {
  it("finds the plugin's background download of the same release", () => {
    const bundles = [bundle("running", "1.0.0", "success"), bundle("waiting", "1.0.1", "pending")];

    expect(reusableBundle(bundles, { version: "1.0.1", checksum: CHECKSUM_A })?.id).toBe("waiting");
  });

  it("refuses without a checksum to bind the bytes to the release", () => {
    const bundles = [bundle("waiting", "1.0.1", "pending")];

    expect(reusableBundle(bundles, { version: "1.0.1" })).toBeNull();
  });

  it("refuses a different checksum", () => {
    const bundles = [bundle("waiting", "1.0.1", "pending", { checksum: CHECKSUM_B })];

    expect(reusableBundle(bundles, { version: "1.0.1", checksum: CHECKSUM_A })).toBeNull();
  });

  it.each(["downloading", "error", "deleting", "deleted"] as const)(
    "refuses a %s bundle",
    (status) => {
      const bundles = [bundle("waiting", "1.0.1", status)];

      expect(reusableBundle(bundles, { version: "1.0.1", checksum: CHECKSUM_A })).toBeNull();
    },
  );
});

describe("isDownloading", () => {
  const now = Date.parse("2026-10-06T10:30:00.000+0000");

  it("sees a download in progress", () => {
    expect(isDownloading([bundle("live", "1.0.1", "downloading")], now)).toBe(true);
  });

  it("ignores a downloading entry a killed process left behind", () => {
    const started = new Date(now - DOWNLOAD_STALE_MS - 1).toISOString();
    expect(
      isDownloading([bundle("orphan", "1.0.1", "downloading", { downloaded: started })], now),
    ).toBe(false);
  });

  it("treats an unreadable start time as live", () => {
    expect(
      isDownloading([bundle("odd", "1.0.1", "downloading", { downloaded: "yesterday-ish" })], now),
    ).toBe(true);
  });

  it("is false when nothing is downloading", () => {
    expect(isDownloading([bundle("done", "1.0.1", "pending")], now)).toBe(false);
  });
});
