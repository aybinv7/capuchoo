import { generateReleaseKeyPair, signRelease, type ResolvedUpdate } from "@capuchoo/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ApkHash } from "../apk-hash.js";
import { configureUpdater, resetUpdaterConfig } from "../config.js";
import type { DownloadProgress } from "../download.service.js";
import { updateGate } from "../gate.js";
import { HttpError, NetworkError } from "../http.js";

type Progress = (progress: DownloadProgress) => void;
type Async<T = void> = () => Promise<T>;

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  pluginListeners: new Map<string, (event: unknown) => void>(),
  lifecycle: { onResume: () => {}, onReconnect: () => {} },
  versionCode: 60,
  checkForUpdate: vi.fn<Async<ResolvedUpdate | null>>(),
  reportUpdateEvent: vi.fn<(...args: unknown[]) => void>(),
  downloadNativeUpdate: vi.fn<(update: ResolvedUpdate, onProgress: Progress) => Promise<string>>(),
  findCachedApk: vi.fn<(update: ResolvedUpdate) => Promise<string | null>>(),
  discardCachedApk: vi.fn<(update: ResolvedUpdate) => Promise<void>>(),
  openNativeInstaller: vi.fn<(path: string) => Promise<void>>(),
  applyOtaUpdate: vi.fn<(update: ResolvedUpdate) => Promise<void>>(),
  hashCachedFile: vi.fn<(path: string) => Promise<ApkHash>>(),
  setChannel: vi.fn<(name: string) => Promise<void>>(),
  clearChannel: vi.fn<Async>(),
  channelOverride: null as string | null,
  reclaimUpdateStorage: vi.fn<(offer: ResolvedUpdate | null) => Promise<unknown>>(async () => ({})),
}));

vi.mock("@capgo/capacitor-updater", () => ({
  CapacitorUpdater: {
    addListener: async (event: string, handler: (payload: unknown) => void) => {
      mocks.pluginListeners.set(event, handler);
      return { remove: async () => {} };
    },
  },
}));

vi.mock("../api.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api.service.js")>()),
  checkForUpdate: mocks.checkForUpdate,
  reportUpdateEvent: mocks.reportUpdateEvent,
}));

vi.mock("../device.js", () => ({
  getPlatform: () => "android",
  getVersionCode: async () => mocks.versionCode,
  isNative: () => true,
  openLocationSettings: async () => false,
  requestLocationPermission: async () => "unavailable",
}));

vi.mock("../download.service.js", () => ({
  apkCacheFileName: (update: ResolvedUpdate) => `app-${update.version}-${update.versionCode}.apk`,
  discardCachedApk: mocks.discardCachedApk,
  downloadNativeUpdate: mocks.downloadNativeUpdate,
  findCachedApk: mocks.findCachedApk,
  pruneApkCache: async () => [],
}));

vi.mock("../install.service.js", () => ({ openNativeInstaller: mocks.openNativeInstaller }));

vi.mock("../ota.service.js", () => ({
  applyOtaUpdate: mocks.applyOtaUpdate,
  getCurrentBundle: async () => null,
  notifyAppReady: async () => {},
}));

vi.mock("../storage.service.js", () => ({ reclaimUpdateStorage: mocks.reclaimUpdateStorage }));

vi.mock("../notification.service.js", () => ({
  canNotify: async () => false,
  clearProgress: async () => {},
  showProgress: async () => {},
}));

vi.mock("../lifecycle.js", () => ({
  watchLifecycle: async (handlers: typeof mocks.lifecycle) => {
    mocks.lifecycle = handlers;
    return [];
  },
}));

vi.mock("../apk-hash.js", () => ({ hashCachedFile: mocks.hashCachedFile }));

vi.mock("../kv-store.js", () => ({
  readValue: async (key: string) => mocks.store.get(key) ?? null,
  writeValue: async (key: string, value: string) => void mocks.store.set(key, value),
  removeValue: async (key: string) => void mocks.store.delete(key),
}));

vi.mock("../channel.service.js", () => ({
  getChannel: async () => mocks.channelOverride ?? "prod",
  getChannelOverride: async () => mocks.channelOverride,
  setChannel: mocks.setChannel,
  clearChannel: mocks.clearChannel,
}));

const { useUpdater, __resetUpdaterState } = await import("./useUpdater.js");
const { INSTALL_ABANDONED_MESSAGE } = await import("./installer-handoff.js");

const SHA = "ab".repeat(32);

const native: ResolvedUpdate = {
  kind: "native",
  version: "1.5.0",
  versionCode: 70,
  downloadUrl: "https://cdn.test/v70.apk?sig=1",
  required: true,
  platform: "android",
  checksum: SHA,
  fileSize: 1000,
};

const ota: ResolvedUpdate = {
  kind: "ota",
  version: "1.4.1",
  downloadUrl: "https://cdn.test/bundle.zip",
  required: true,
  checksum: SHA,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function gateOf(updater: ReturnType<typeof useUpdater>) {
  return updateGate({
    available: updater.updateAvailable.value,
    required: updater.isRequired.value,
    kind: updater.currentUpdate.value?.kind ?? null,
    downloading: updater.isDownloading.value,
    installing: updater.isInstalling.value,
    downloaded: updater.cachedPath.value !== null,
    handedToInstaller: updater.handedToInstaller.value,
    installAbandoned: updater.installAbandoned.value,
  });
}

async function offer(update: ResolvedUpdate) {
  mocks.checkForUpdate.mockResolvedValue(update);
  const updater = useUpdater();
  await updater.init();
  return updater;
}

async function handToInstaller(updater: ReturnType<typeof useUpdater>) {
  await updater.startDownload();
  await updater.installNativeUpdate();
  expect(updater.handedToInstaller.value).toBe(true);
}

beforeEach(() => {
  __resetUpdaterState();
  resetUpdaterConfig();
  configureUpdater({ apiUrl: "https://api.test", appId: "com.efficy.app", appName: "Efficy" });
  mocks.store.clear();
  mocks.pluginListeners.clear();
  mocks.versionCode = 60;
  mocks.channelOverride = null;
  vi.clearAllMocks();
  mocks.findCachedApk.mockResolvedValue(null);
  mocks.downloadNativeUpdate.mockResolvedValue("file:///cache/app-1.5.0-70.apk");
  mocks.openNativeInstaller.mockResolvedValue(undefined);
  mocks.applyOtaUpdate.mockResolvedValue(undefined);
  mocks.hashCachedFile.mockResolvedValue({ kind: "hashed", sha256: SHA });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the installer handoff", () => {
  it("returns to 'install again' when the user cancels, keeping the required gate usable", async () => {
    const updater = await offer(native);
    await handToInstaller(updater);

    mocks.lifecycle.onResume();
    await flush();

    expect(updater.handedToInstaller.value).toBe(false);
    expect(updater.cachedPath.value).toBe("file:///cache/app-1.5.0-70.apk");
    expect(updater.state.value.installFailures).toBe(1);
    expect(updater.installAbandoned.value).toBe(false);
    expect(updater.statusMessage.value).toMatch(/Tap Install to try again/);
    expect(gateOf(updater)).toMatchObject({ state: "must-install", blocked: true });
  });

  it("finishes when the installed build has reached the offered one", async () => {
    const updater = await offer(native);
    await handToInstaller(updater);

    mocks.versionCode = 70;
    mocks.lifecycle.onResume();
    await flush();

    expect(updater.updateAvailable.value).toBe(false);
    expect(updater.currentUpdate.value).toBeNull();
    expect(updater.handedToInstaller.value).toBe(false);
    expect(gateOf(updater).blocked).toBe(false);
    expect(mocks.store.has("capuchoo.install-failures")).toBe(false);
  });

  it("stops blocking after two failed installs of the same version, with a clear error", async () => {
    const updater = await offer(native);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await handToInstaller(updater);
      mocks.lifecycle.onResume();
      await flush();
    }

    expect(updater.installAbandoned.value).toBe(true);
    expect(updater.error.value).toBe(INSTALL_ABANDONED_MESSAGE);
    expect(gateOf(updater)).toMatchObject({ state: "open", blocked: false });
    expect(updater.cachedPath.value).not.toBeNull();

    await updater.dismiss();
    expect(updater.updateAvailable.value).toBe(false);
  });

  it("remembers repeated failure across a relaunch", async () => {
    mocks.store.set("capuchoo.install-failures", JSON.stringify({ versionCode: 70, failures: 2 }));

    const updater = await offer(native);

    expect(updater.installAbandoned.value).toBe(true);
    expect(gateOf(updater).blocked).toBe(false);
  });

  it("settles a resume that arrived while the installer was still being launched", async () => {
    const updater = await offer(native);
    await updater.startDownload();
    mocks.openNativeInstaller.mockImplementationOnce(async () => {
      mocks.lifecycle.onResume();
    });

    await updater.installNativeUpdate();
    await flush();

    expect(updater.handedToInstaller.value).toBe(false);
    expect(updater.state.value.installFailures).toBe(1);
  });

  it("does not count a resume that happened with no handoff", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const updater = await offer(native);

    mocks.lifecycle.onResume();
    await flush();

    expect(updater.state.value.installFailures).toBe(0);
  });
});

describe("the plugin's updateAvailable event", () => {
  it("never clears required: true from the server", async () => {
    const updater = await offer(ota);

    mocks.pluginListeners.get("updateAvailable")!({
      bundle: { id: "bundle-1", version: "1.4.1", checksum: SHA },
    });

    expect(updater.currentUpdate.value).toMatchObject({ required: true, bundleId: "bundle-1" });
    expect(updater.isRequired.value).toBe(true);
  });

  it("keeps required for a newer bundle and asks the server about it", async () => {
    const updater = await offer(ota);
    mocks.checkForUpdate.mockClear();
    mocks.checkForUpdate.mockResolvedValue({ ...ota, version: "1.4.2", signature: "sig" });

    mocks.pluginListeners.get("updateAvailable")!({
      bundle: { id: "b2", version: "1.4.2", checksum: SHA },
    });
    expect(updater.currentUpdate.value).toMatchObject({ version: "1.4.2", required: true });

    await flush();
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(updater.currentUpdate.value).toMatchObject({
      version: "1.4.2",
      required: true,
      bundleId: "b2",
      signature: "sig",
    });
  });

  it("ignores a bundle whose checksum differs from the one the server described", async () => {
    const updater = await offer(ota);

    mocks.pluginListeners.get("updateAvailable")!({
      bundle: { id: "evil", version: "1.4.1", checksum: "cd".repeat(32) },
    });

    expect(updater.currentUpdate.value?.bundleId).toBeUndefined();
  });

  it("does not displace a native update", async () => {
    const updater = await offer(native);

    mocks.pluginListeners.get("updateAvailable")!({ bundle: { id: "b", version: "9.0.0" } });

    expect(updater.currentUpdate.value?.kind).toBe("native");
  });
});

describe("reclaiming update storage", () => {
  it("prunes once the server answers, keeping the OTA update on offer", async () => {
    await offer(ota);

    expect(mocks.reclaimUpdateStorage).toHaveBeenCalledOnce();
    expect(mocks.reclaimUpdateStorage.mock.calls[0]![0]).toMatchObject({
      kind: "ota",
      version: "1.4.1",
      checksum: SHA,
    });
  });

  it("prunes with nothing to keep when the device is up to date", async () => {
    mocks.checkForUpdate.mockResolvedValue(null);
    await useUpdater().init();

    expect(mocks.reclaimUpdateStorage).toHaveBeenCalledWith(null);
  });

  it("keeps no OTA bundle for a native update", async () => {
    await offer(native);

    expect(mocks.reclaimUpdateStorage).toHaveBeenCalledWith(null);
  });

  it("does not prune when the server did not answer", async () => {
    mocks.checkForUpdate.mockRejectedValue(new NetworkError("https://api.test", true, null));
    await useUpdater().init();

    expect(mocks.reclaimUpdateStorage).not.toHaveBeenCalled();
  });

  it("does not prune while an update is mid-flight", async () => {
    const updater = await offer(native);
    mocks.reclaimUpdateStorage.mockClear();
    let finish: (path: string) => void = () => {};
    mocks.downloadNativeUpdate.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const download = updater.startDownload();
    await flush();
    await updater.check();
    finish("file:///cache/app-1.5.0-70.apk");
    await download;

    expect(mocks.reclaimUpdateStorage).not.toHaveBeenCalled();
  });
});

describe("flaky networks", () => {
  it("keeps an unanswered check out of the user-facing error", async () => {
    mocks.checkForUpdate.mockRejectedValue(new NetworkError("https://api.test", true, null));
    const updater = useUpdater();
    await updater.init();

    expect(updater.error.value).toBeNull();
    expect(updater.lastCheckError.value).toMatch(/did not answer/);
  });

  it("treats a 5xx the same way", async () => {
    mocks.checkForUpdate.mockRejectedValue(new HttpError("https://api.test", 503, "Unavailable"));
    const updater = useUpdater();
    await updater.init();

    expect(updater.error.value).toBeNull();
    expect(updater.lastCheckError.value).toMatch(/503/);
  });

  it("surfaces a real refusal", async () => {
    mocks.checkForUpdate.mockRejectedValue(
      new HttpError("https://api.test", 403, "Forbidden", "App disabled"),
    );
    const updater = useUpdater();
    await updater.init();

    expect(updater.error.value).toBe("The update service refused this request: App disabled");
  });

  it("clears a refusal once the server answers again", async () => {
    mocks.checkForUpdate.mockRejectedValueOnce(new HttpError("https://api.test", 403, "Forbidden"));
    const updater = useUpdater();
    await updater.init();
    mocks.checkForUpdate.mockResolvedValue(null);

    await updater.check();

    expect(updater.error.value).toBeNull();
  });

  it("re-checks on resume only once the last check is older than recheckIntervalMs", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    configureUpdater({ recheckIntervalMs: 60_000 });
    mocks.checkForUpdate.mockResolvedValue(null);
    await useUpdater().init();
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 59_000);
    mocks.lifecycle.onResume();
    await flush();
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 2_000);
    mocks.lifecycle.onResume();
    await flush();
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it("re-checks when the network comes back after an unanswered check", async () => {
    mocks.checkForUpdate.mockRejectedValueOnce(new NetworkError("https://api.test", false, null));
    const updater = useUpdater();
    await updater.init();
    mocks.checkForUpdate.mockResolvedValue(ota);

    mocks.lifecycle.onReconnect();
    await flush();

    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(2);
    expect(updater.currentUpdate.value?.version).toBe("1.4.1");
    expect(updater.lastCheckError.value).toBeNull();
  });

  it("does not re-check on reconnect when the last check is fresh and succeeded", async () => {
    mocks.checkForUpdate.mockResolvedValue(null);
    await useUpdater().init();

    mocks.lifecycle.onReconnect();
    await flush();

    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it("joins a check already running instead of starting another", async () => {
    let answer: (value: null) => void = () => {};
    mocks.checkForUpdate.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const updater = useUpdater();

    const first = updater.check();
    const second = updater.check();
    answer(null);

    await Promise.all([first, second]);
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("the runtime channel", () => {
  it("switches, remembers, withdraws the old offer and checks the new channel", async () => {
    const updater = await offer(ota);
    mocks.setChannel.mockImplementation(async (name: string) => {
      mocks.channelOverride = name;
    });
    mocks.checkForUpdate.mockResolvedValue(null);

    await updater.setChannel("beta");

    expect(mocks.setChannel).toHaveBeenCalledWith("beta");
    expect(updater.channelOverride.value).toBe("beta");
    expect(await updater.getChannel()).toBe("beta");
    expect(updater.updateAvailable.value).toBe(false);
    expect(mocks.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it("returns to the build's default", async () => {
    mocks.channelOverride = "beta";
    const updater = await offer(ota);
    mocks.clearChannel.mockImplementation(async () => {
      mocks.channelOverride = null;
    });

    await updater.clearChannel();

    expect(updater.channelOverride.value).toBeNull();
    expect(await updater.getChannel()).toBe("prod");
  });

  it("keeps the current channel when the server refuses", async () => {
    const updater = await offer(ota);
    mocks.setChannel.mockRejectedValue(new Error("Channel does not allow self-assignment"));

    await expect(updater.setChannel("secret")).rejects.toThrow(/self-assignment/);
    expect(updater.channelOverride.value).toBeNull();
    expect(updater.updateAvailable.value).toBe(true);
  });
});

describe("native downloads", () => {
  it("deletes an APK whose SHA-256 does not match, and says so", async () => {
    mocks.hashCachedFile.mockResolvedValue({ kind: "hashed", sha256: "00".repeat(32) });
    const updater = await offer(native);

    await updater.startDownload();

    expect(mocks.discardCachedApk).toHaveBeenCalledTimes(1);
    expect(updater.cachedPath.value).toBeNull();
    expect(updater.error.value).toMatch(/damaged or was altered/);
    expect(mocks.openNativeInstaller).not.toHaveBeenCalled();
  });

  it("falls back to the size check when the file cannot be hashed and nothing is signed", async () => {
    mocks.hashCachedFile.mockResolvedValue({ kind: "unavailable", reason: "old plugin" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const updater = await offer(native);

    await updater.startDownload();
    await updater.installNativeUpdate();

    expect(updater.handedToInstaller.value).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/size check only/), "old plugin");
    warn.mockRestore();
  });

  it("re-checks for a fresh link and retries once when the signed URL has expired", async () => {
    const updater = await offer(native);
    const renewed = { ...native, downloadUrl: "https://cdn.test/v70.apk?sig=2" };
    mocks.checkForUpdate.mockResolvedValue(renewed);
    mocks.downloadNativeUpdate
      .mockRejectedValueOnce({ code: "OS-PLUG-FLTR-0010", data: { httpStatus: 403 } })
      .mockResolvedValueOnce("file:///cache/app-1.5.0-70.apk");

    await updater.startDownload();

    expect(mocks.downloadNativeUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.downloadNativeUpdate.mock.calls[1]![0]).toMatchObject({
      downloadUrl: "https://cdn.test/v70.apk?sig=2",
    });
    expect(updater.error.value).toBeNull();
    expect(updater.cachedPath.value).not.toBeNull();
  });

  it("does not retry a failure that is not an expired link", async () => {
    const updater = await offer(native);
    mocks.downloadNativeUpdate.mockRejectedValue(new Error("disk full"));

    await updater.startDownload();

    expect(mocks.downloadNativeUpdate).toHaveBeenCalledTimes(1);
    expect(updater.error.value).toBe("disk full");
  });

  it("keeps progress and the cached path when a check lands mid-download", async () => {
    const updater = await offer(native);
    let finish: (path: string) => void = () => {};
    mocks.downloadNativeUpdate.mockImplementation(
      (_update: ResolvedUpdate, onProgress: Progress) => {
        onProgress({ loaded: 400, total: 1000, percent: 40 });
        return new Promise((resolve) => (finish = resolve));
      },
    );

    const download = updater.startDownload();
    await flush();
    await updater.check();

    expect(updater.isDownloading.value).toBe(true);
    expect(updater.progress.value.percent).toBe(40);

    finish("file:///cache/app-1.5.0-70.apk");
    await download;
    expect(updater.cachedPath.value).toBe("file:///cache/app-1.5.0-70.apk");
  });
});

const keys = await generateReleaseKeyPair();
const other = await generateReleaseKeyPair();

describe("release signatures", () => {
  const sign = (update: ResolvedUpdate, privateKey = keys.privateKey) =>
    signRelease(
      {
        kind: update.kind,
        appId: "com.efficy.app",
        platform: "android",
        version: update.version,
        versionCode: update.kind === "native" ? update.versionCode : null,
        sha256: SHA,
      },
      privateKey,
    );

  beforeEach(() => {
    configureUpdater({ publicKey: keys.publicKey });
  });

  it("applies an OTA bundle signed by the baked-in key", async () => {
    const updater = await offer({ ...ota, appId: "com.efficy.app", signature: await sign(ota) });

    await updater.startDownload();

    expect(updater.error.value).toBeNull();
    expect(mocks.applyOtaUpdate).toHaveBeenCalledTimes(1);
  });

  it("refuses an OTA bundle signed by another key", async () => {
    const updater = await offer({ ...ota, signature: await sign(ota, other.privateKey) });

    await updater.startDownload();

    expect(mocks.applyOtaUpdate).not.toHaveBeenCalled();
    expect(updater.error.value).toMatch(/failed its signature check/);
  });

  it("refuses an unsigned OTA bundle when signatures are required", async () => {
    const updater = await offer(ota);

    await updater.startDownload();

    expect(mocks.applyOtaUpdate).not.toHaveBeenCalled();
    expect(updater.error.value).toMatch(/not signed/);
  });

  it("applies an unsigned bundle when signatures were explicitly made optional", async () => {
    configureUpdater({ requireSignature: false });
    const updater = await offer(ota);

    await updater.startDownload();

    expect(mocks.applyOtaUpdate).toHaveBeenCalledTimes(1);
  });

  it("refuses a bundle whose signed claim does not match what is served", async () => {
    const signature = await sign(ota);
    const updater = await offer({ ...ota, version: "1.4.9", signature });

    await updater.startDownload();

    expect(mocks.applyOtaUpdate).not.toHaveBeenCalled();
  });

  it("verifies a native build before opening the installer", async () => {
    const updater = await offer({ ...native, signature: await sign(native) });

    await handToInstaller(updater);

    expect(mocks.openNativeInstaller).toHaveBeenCalledTimes(1);
  });

  it("refuses a native build signed for another version code", async () => {
    const signature = await sign({ ...native, versionCode: 71 });
    const updater = await offer({ ...native, signature });

    await updater.startDownload();
    await updater.installNativeUpdate();

    expect(mocks.downloadNativeUpdate).not.toHaveBeenCalled();
    expect(mocks.openNativeInstaller).not.toHaveBeenCalled();
    expect(updater.error.value).toMatch(/failed its signature check/);
  });

  it("refuses an APK it cannot hash when the release must be signed", async () => {
    mocks.hashCachedFile.mockResolvedValue({ kind: "unavailable", reason: "old plugin" });
    const updater = await offer({ ...native, signature: await sign(native) });

    await updater.startDownload();

    expect(updater.error.value).toMatch(/could not be read to verify/);
    await updater.installNativeUpdate();
    expect(mocks.openNativeInstaller).not.toHaveBeenCalled();
  });
});
