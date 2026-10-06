/**
 * The plugin's JavaScript `download()` stores a fresh copy even when the same
 * release is already on disk, which is how a clean install plus one OTA left
 * `0.2.4-dev.15` stored twice: once `pending` from the plugin's background
 * download, once `success` from the app's own.
 */

import type { ResolvedUpdate } from "@capuchoo/core";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { StoredBundle } from "./bundle-retention.js";

const HASH = "d".repeat(64);

const mocks = vi.hoisted(() => ({
  bundles: [] as StoredBundle[],
  set: vi.fn<(options: { id: string }) => Promise<void>>(async () => {}),
  download: vi.fn<(options: { url: string; version: string }) => Promise<{ id: string }>>(
    async () => ({ id: "fresh" }),
  ),
}));

vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: {
    list: async () => ({ bundles: mocks.bundles }),
    set: mocks.set,
    download: mocks.download,
  },
}));

vi.mock("./device.js", () => ({ isNative: () => true }));

const { applyOtaUpdate } = await import("./ota.service.js");

function update(overrides: Partial<ResolvedUpdate> = {}): ResolvedUpdate {
  return {
    kind: "ota",
    version: "0.2.4-dev.15",
    downloadUrl: "https://cdn.test/bundle.zip",
    required: true,
    checksum: HASH,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bundles = [];
});

describe("applyOtaUpdate", () => {
  it("applies the plugin's stored download of the same release instead of fetching it again", async () => {
    mocks.bundles = [
      {
        id: "background",
        version: "0.2.4-dev.15",
        status: "pending",
        checksum: HASH,
        downloaded: "",
      },
    ];
    const offered = update();

    await applyOtaUpdate(offered);

    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({ id: "background" });
    expect(offered.bundleId).toBe("background");
  });

  it("downloads when the stored copy is a different release", async () => {
    mocks.bundles = [
      {
        id: "other",
        version: "0.2.4-dev.15",
        status: "pending",
        checksum: "e".repeat(64),
        downloaded: "",
      },
    ];

    await applyOtaUpdate(update());

    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({ id: "fresh" });
  });

  it("downloads when the server sent no checksum to match against", async () => {
    mocks.bundles = [
      {
        id: "background",
        version: "0.2.4-dev.15",
        status: "pending",
        checksum: HASH,
        downloaded: "",
      },
    ];

    await applyOtaUpdate(update({ checksum: undefined }));

    expect(mocks.download).toHaveBeenCalledOnce();
  });
});
