import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { StoredBundle } from "./bundle-retention.js";

const HASH = "c".repeat(64);
const now = new Date().toISOString();

const mocks = vi.hoisted(() => ({
  bundles: [] as StoredBundle[],
  current: { id: "builtin", status: "success" } as { id: string; status: string },
  next: null as { id: string } | null,
  cache: [] as Array<{ name: string; type: "file" | "directory" }>,
  filesystemInstalled: true,
  delete: vi.fn<(options: { id: string }) => Promise<void>>(async () => {}),
  list: vi.fn<(options?: { raw?: boolean }) => Promise<{ bundles: StoredBundle[] }>>(),
  deleteFile: vi.fn<(options: { path: string }) => Promise<void>>(async () => {}),
}));

vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: {
    list: mocks.list,
    current: async () => ({ bundle: mocks.current, native: "1.0.0" }),
    getNextBundle: async () => mocks.next,
    delete: mocks.delete,
  },
}));

vi.mock("./device.js", () => ({ isNative: () => true }));

vi.mock("./optional-plugins.js", () => ({
  nativePlugins: {
    filesystem: async () => {
      if (!mocks.filesystemInstalled) throw new Error("not installed");
      return {
        Directory: { Cache: "CACHE" },
        Filesystem: {
          readdir: async () => ({ files: mocks.cache }),
          deleteFile: mocks.deleteFile,
        },
      };
    },
  },
}));

const { reclaimUpdateStorage } = await import("./storage.service.js");

function stored(id: string, version: string, status: string): StoredBundle {
  return { id, version, status, checksum: HASH, downloaded: now };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockImplementation(async () => ({ bundles: mocks.bundles }));
  mocks.bundles = [];
  mocks.current = { id: "running", status: "success" };
  mocks.next = null;
  mocks.cache = [];
  mocks.filesystemInstalled = true;
});

describe("reclaimUpdateStorage", () => {
  it("deletes stale bundles through the plugin and clears the delta cache", async () => {
    mocks.bundles = [stored("running", "1.0.1", "success"), stored("copy", "1.0.1", "pending")];
    mocks.cache = [
      { name: `${HASH}_index.js`, type: "file" },
      { name: "partial_x.tmp", type: "file" },
    ];

    const result = await reclaimUpdateStorage(null);

    expect(mocks.list).toHaveBeenCalledWith({ raw: true });
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith({ id: "copy" });
    expect(mocks.deleteFile).toHaveBeenCalledExactlyOnceWith({
      directory: "CACHE",
      path: `capgo_downloads/${HASH}_index.js`,
    });
    expect(result).toEqual({ deletedBundles: ["copy"], deletedCacheEntries: 1 });
  });

  it("does nothing until the running bundle is confirmed", async () => {
    mocks.current = { id: "running", status: "pending" };
    mocks.bundles = [stored("running", "1.0.1", "pending"), stored("old", "1.0.0", "success")];
    mocks.cache = [{ name: `${HASH}_index.js`, type: "file" }];

    const result = await reclaimUpdateStorage(null);

    expect(result.skipped).toBe("unconfirmed");
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("keeps the next bundle and the update on offer", async () => {
    mocks.next = { id: "next" };
    mocks.bundles = [
      stored("running", "1.0.0", "success"),
      stored("next", "1.0.2", "pending"),
      stored("waiting", "1.0.1", "pending"),
    ];

    await reclaimUpdateStorage({ version: "1.0.1", checksum: HASH });

    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("leaves the delta cache alone while the plugin is downloading", async () => {
    mocks.bundles = [stored("running", "1.0.0", "success"), stored("live", "1.0.2", "downloading")];
    mocks.cache = [{ name: `${HASH}_index.js`, type: "file" }];

    const result = await reclaimUpdateStorage(null);

    expect(result.skipped).toBe("downloading");
    expect(mocks.deleteFile).not.toHaveBeenCalled();
  });

  it("carries on past a bundle the plugin refuses to delete", async () => {
    mocks.bundles = [
      stored("running", "1.0.0", "success"),
      stored("stuck", "0.9.0", "pending"),
      stored("gone", "0.9.1", "pending"),
    ];
    mocks.delete.mockRejectedValueOnce(new Error("Delete failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await reclaimUpdateStorage(null);

    expect(result.deletedBundles).toEqual(["gone"]);
  });

  it("skips everything when the plugin state cannot be read", async () => {
    mocks.list.mockRejectedValueOnce(new Error("Could not list bundles"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await reclaimUpdateStorage(null);

    expect(result.skipped).toBe("unknown-state");
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("still prunes bundles when @capacitor/filesystem is not installed", async () => {
    mocks.filesystemInstalled = false;
    mocks.bundles = [stored("running", "1.0.0", "success"), stored("old", "0.9.0", "pending")];

    const result = await reclaimUpdateStorage(null);

    expect(result).toEqual({ deletedBundles: ["old"], deletedCacheEntries: 0 });
  });

  it("joins a run already in progress", async () => {
    mocks.bundles = [stored("running", "1.0.0", "success"), stored("old", "0.9.0", "pending")];

    const [first, second] = await Promise.all([
      reclaimUpdateStorage(null),
      reclaimUpdateStorage(null),
    ]);

    expect(first).toBe(second);
    expect(mocks.delete).toHaveBeenCalledOnce();
  });
});
