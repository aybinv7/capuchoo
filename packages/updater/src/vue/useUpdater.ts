import type { PluginListenerHandle } from "@capacitor/core";
import type { ResolvedUpdate } from "@capuchoo/core";
import { computed, readonly } from "vue";
import {
  UpdateCheckBlockedError,
  UpdaterConfigError,
  checkForUpdate,
  reportUpdateEvent,
} from "../api.service.js";
import { ApkIntegrityError, checkApkIntegrity } from "../apk-integrity.js";
import {
  clearChannel as forgetChannel,
  getChannel,
  getChannelOverride,
  setChannel as chooseChannel,
} from "../channel.service.js";
import { isExpiredLinkError, isTransientError } from "../check-errors.js";
import { getUpdaterConfig } from "../config.js";
import {
  getPlatform,
  getVersionCode,
  isNative,
  openLocationSettings,
  requestLocationPermission,
} from "../device.js";
import {
  apkCacheFileName,
  discardCachedApk,
  downloadNativeUpdate,
  findCachedApk,
  pruneApkCache,
  type DownloadProgress,
} from "../download.service.js";
import { HttpError } from "../http.js";
import { openNativeInstaller } from "../install.service.js";
import { watchLifecycle } from "../lifecycle.js";
import { canNotify, clearProgress, showProgress } from "../notification.service.js";
import { applyOtaUpdate, getCurrentBundle, notifyAppReady } from "../ota.service.js";
import { verifyUpdateSignature } from "../release-verification.js";
import { reclaimUpdateStorage } from "../storage.service.js";
import { isSameArtefact } from "../update-merge.js";
import {
  forgetOvertakenInstall,
  restoreInstallAttempts,
  settleInstallerHandoff,
} from "./installer-handoff.js";
import { attachPluginListeners } from "./plugin-listeners.js";
import {
  __resetPublishState,
  isVerifiedPath,
  markVerifiedPath,
  publishUpdate,
  updateAge,
  withdrawUpdate,
} from "./publish-update.js";
import {
  DONE_PROGRESS,
  NO_PROGRESS,
  initialState,
  isBusy,
  state,
  type UpdaterState,
} from "./updater-state.js";

export type { UpdaterState } from "./updater-state.js";

const SIGNED_LINK_REFRESH_MS = 45 * 60_000;
const CHECKING = "Checking for updates...";

const listeners: PluginListenerHandle[] = [];
let initialised = false;
let inflightCheck: Promise<boolean> | null = null;
let checkErrorShown = false;
let launchingInstaller = false;
let resumedWhileLaunching = false;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function showCheckError(message: string): void {
  state.value.error = message;
  checkErrorShown = true;
}

function recordCheckFailure(error: unknown, silent: boolean): void {
  if (error instanceof UpdaterConfigError) {
    showCheckError("Updates are not configured for this build");
    console.error("[capuchoo]", error.problems.join("; "));
    return;
  }
  if (error instanceof UpdateCheckBlockedError) {
    showCheckError(`The update service rejected this build: ${error.message}`);
    console.error("[capuchoo]", error.message, error.response);
    return;
  }
  if (error instanceof HttpError && !isTransientError(error)) {
    showCheckError(
      `The update service refused this request: ${error.serverMessage ?? `HTTP ${error.status}`}`,
    );
    console.error("[capuchoo]", error.message);
    return;
  }

  state.value.lastCheckError = errorMessage(error, "The update check failed");
  if (!isTransientError(error)) console.error("[capuchoo] update check failed", error);
  else if (!silent) console.warn("[capuchoo] update check did not get an answer", error);
}

/**
 * Prunes stored bundles once the server has said what is on offer, keeping
 * whatever the prompt may still apply. Never while an update is mid-flight.
 */
function reclaimStorage(): void {
  if (isBusy()) return;
  const offered = state.value.currentUpdate;
  reclaimUpdateStorage(offered?.kind === "ota" ? offered : null).catch((error: unknown) => {
    console.warn("[capuchoo] could not reclaim update storage", error);
  });
}

async function runCheck(silent: boolean): Promise<boolean> {
  state.value.checking = true;
  if (!isBusy()) state.value.statusMessage = CHECKING;

  try {
    const update = await checkForUpdate();

    state.value.lastCheckedAt = Date.now();
    state.value.lastCheckError = null;
    if (checkErrorShown) {
      state.value.error = null;
      checkErrorShown = false;
    }

    if (!update) {
      if (!state.value.updateAvailable) {
        state.value.lastCheckMessage = `${getUpdaterConfig().appName} is up to date`;
      }
      reclaimStorage();
      return false;
    }

    const action = publishUpdate(update, "server");
    const current = state.value.currentUpdate;

    if (action === "replace" && current?.kind === "native") {
      await restoreInstallAttempts(current);
      if (!state.value.cachedPath) {
        state.value.cachedPath = await findCachedApk(current);
        if (state.value.cachedPath) {
          state.value.progress = { ...DONE_PROGRESS };
          state.value.statusMessage = "Ready to install.";
        }
      }
    }

    reportUpdateEvent("check", update);
    reclaimStorage();
    return true;
  } catch (error) {
    recordCheckFailure(error, silent);
    return false;
  } finally {
    state.value.checking = false;
    if (state.value.statusMessage === CHECKING) state.value.statusMessage = "";
  }
}

/**
 * Checks for an update. Offline and 5xx answers are retried with backoff and
 * never reach `error`; only a server refusal does. A check while one is
 * running joins it.
 *
 * @param silent suppresses console noise for background checks.
 * @returns whether an update is now pending.
 */
function check(silent = false): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false);
  inflightCheck ??= runCheck(silent).finally(() => {
    inflightCheck = null;
  });
  return inflightCheck;
}

async function freshUpdate(update: ResolvedUpdate, force: boolean): Promise<ResolvedUpdate> {
  if (!force && updateAge() < SIGNED_LINK_REFRESH_MS) return update;

  await check(true);
  const current = state.value.currentUpdate;
  return current && isSameArtefact(current, update) ? current : update;
}

async function downloadApk(
  update: ResolvedUpdate,
  onProgress: (progress: DownloadProgress) => void,
): Promise<{ path: string; update: ResolvedUpdate }> {
  try {
    return { path: await downloadNativeUpdate(update, onProgress), update };
  } catch (error) {
    if (!isExpiredLinkError(error)) throw error;
    const renewed = await freshUpdate(update, true);
    if (renewed.downloadUrl === update.downloadUrl) throw error;
    return { path: await downloadNativeUpdate(renewed, onProgress), update: renewed };
  }
}

async function verifyApk(update: ResolvedUpdate, path: string): Promise<void> {
  if (isVerifiedPath(path)) return;

  const config = getUpdaterConfig();
  await verifyUpdateSignature(update, config, getPlatform());
  await checkApkIntegrity(update, apkCacheFileName(update), {
    requireHash: config.requireSignature,
  });
  markVerifiedPath(path);
}

async function rejectApk(update: ResolvedUpdate, error: unknown): Promise<void> {
  if (!(error instanceof ApkIntegrityError) || !error.corrupt) return;
  await discardCachedApk(update);
  state.value.cachedPath = null;
  state.value.progress = { ...NO_PROGRESS };
  markVerifiedPath(null);
}

async function downloadNative(update: ResolvedUpdate, notify: boolean): Promise<void> {
  const { appName } = getUpdaterConfig();
  const { path, update: downloaded } = await downloadApk(update, (progress) => {
    state.value.progress = progress;
    if (notify) {
      void showProgress({
        title: `Downloading ${appName} ${update.version}`,
        percent: progress.percent,
        body: `${progress.percent}%`,
      });
    }
  });

  state.value.cachedPath = path;
  if (notify) await clearProgress();

  try {
    await verifyApk(downloaded, path);
  } catch (error) {
    await rejectApk(downloaded, error);
    throw error;
  }

  state.value.progress = { ...DONE_PROGRESS };
  state.value.statusMessage = "Download complete. Tap Install to continue.";
  reportUpdateEvent("download_complete", downloaded);
}

async function applyOta(update: ResolvedUpdate): Promise<void> {
  await verifyUpdateSignature(update, getUpdaterConfig(), getPlatform());
  reportUpdateEvent("install", update, undefined, { keepalive: true });
  await applyOtaUpdate(update);
}

/** Downloads the pending update. For native updates, install is a second step. */
async function startDownload(): Promise<void> {
  const pending = state.value.currentUpdate;
  if (!pending || isBusy()) return;

  state.value.error = null;
  checkErrorShown = false;

  if (pending.kind === "native" && state.value.cachedPath) {
    await installNativeUpdate();
    return;
  }

  state.value.downloading = true;
  state.value.statusMessage =
    pending.kind === "native" ? "Downloading the new version..." : "Downloading update...";

  const notify =
    pending.kind === "native" && getUpdaterConfig().notifyProgress ? await canNotify() : false;
  let update = pending;

  try {
    update = await freshUpdate(pending, false);
    if (update.kind === "native") {
      await verifyUpdateSignature(update, getUpdaterConfig(), getPlatform());
      await downloadNative(update, notify);
      return;
    }
    await applyOta(update);
  } catch (error) {
    state.value.error = errorMessage(error, "The update failed");
    if (notify) await clearProgress();
    reportUpdateEvent("error", update, { error: state.value.error });
  } finally {
    state.value.downloading = false;
    if (!state.value.cachedPath) state.value.statusMessage = "";
  }
}

/** Verifies the downloaded APK, then hands it to the Android installer. */
async function installNativeUpdate(): Promise<void> {
  const update = state.value.currentUpdate;
  const path = state.value.cachedPath;
  if (!update || update.kind !== "native" || !path || state.value.installing) return;

  state.value.installing = true;
  state.value.error = null;
  if (!isVerifiedPath(path)) state.value.statusMessage = "Verifying the update...";

  try {
    await verifyApk(update, path);

    launchingInstaller = true;
    resumedWhileLaunching = false;
    await openNativeInstaller(path);

    state.value.handedToInstaller = true;
    state.value.statusMessage = "Confirm the installation to finish updating.";
    reportUpdateEvent("install", update);
    if (resumedWhileLaunching) void settleInstallerHandoff();
  } catch (error) {
    state.value.handedToInstaller = false;
    state.value.error = errorMessage(error, "Installation failed");
    state.value.statusMessage = "";
    await rejectApk(update, error);
    reportUpdateEvent("error", update, { error: state.value.error });
  } finally {
    launchingInstaller = false;
    state.value.installing = false;
  }
}

function isStale(): boolean {
  const last = state.value.lastCheckedAt;
  return last === null || Date.now() - last >= getUpdaterConfig().recheckIntervalMs;
}

function onResume(): void {
  if (launchingInstaller) {
    resumedWhileLaunching = true;
    return;
  }
  if (state.value.handedToInstaller) {
    void settleInstallerHandoff();
    return;
  }
  if (isStale()) void check(true);
}

function onReconnect(): void {
  if (state.value.lastCheckError !== null || isStale()) void check(true);
}

/**
 * Wires up the updater. Call once, from the app's Capacitor bootstrap.
 *
 * Also calls `notifyAppReady`, without which the OTA plugin rolls the bundle
 * back after `appReadyTimeout`.
 */
async function init(): Promise<void> {
  if (!isNative() || initialised) return;
  initialised = true;

  try {
    await notifyAppReady();
    listeners.push(...(await attachPluginListeners(() => void check(true))));
    listeners.push(...(await watchLifecycle({ onResume, onReconnect })));
    state.value.channelOverride = await getChannelOverride();

    const installedVersionCode = await getVersionCode();
    await forgetOvertakenInstall(installedVersionCode);
    await pruneApkCache({ installedVersionCode });
  } catch (error) {
    console.error("[capuchoo] updater start-up step failed", error);
  }

  await check(true);
}

async function cleanup(): Promise<void> {
  await Promise.all(listeners.splice(0).map((listener) => listener.remove()));
  initialised = false;
}

/** Dismisses a pending update. Refuses mid-flight, and for a required update that can still install. */
async function dismiss(): Promise<void> {
  const update = state.value.currentUpdate;
  if (!update || isBusy()) return;
  if (update.required && !state.value.installAbandoned) return;

  reportUpdateEvent("cancel", update);
  withdrawUpdate();
}

/**
 * Moves this device to another channel, remembered across launches and sent
 * with every check, then checks it. Throws when the server refuses.
 */
async function setChannel(name: string): Promise<void> {
  await chooseChannel(name);
  state.value.channelOverride = await getChannelOverride();
  if (!isBusy()) withdrawUpdate();
  await check(true);
}

/** Returns to the build's default channel, then checks it. */
async function clearChannel(): Promise<void> {
  await forgetChannel();
  state.value.channelOverride = null;
  if (!isBusy()) withdrawUpdate();
  await check(true);
}

export function useUpdater() {
  return {
    state: readonly(state),
    isChecking: computed(() => state.value.checking),
    isDownloading: computed(() => state.value.downloading),
    isInstalling: computed(() => state.value.installing),
    updateAvailable: computed(() => state.value.updateAvailable),
    currentUpdate: computed(() => state.value.currentUpdate),
    progress: computed(() => state.value.progress),
    cachedPath: computed(() => state.value.cachedPath),
    error: computed(() => state.value.error),
    /** Why the last check got no answer. Diagnostic; never shown as an update problem. */
    lastCheckError: computed(() => state.value.lastCheckError),
    statusMessage: computed(() => state.value.statusMessage),
    lastCheckMessage: computed(() => state.value.lastCheckMessage),
    /** True when the user may not postpone the update. */
    isRequired: computed(
      () => state.value.currentUpdate?.required === true && !state.value.installAbandoned,
    ),
    /** True while Android's own install dialog is waiting on the user. */
    handedToInstaller: computed(() => state.value.handedToInstaller),
    /** True once installing this native version has failed too often to keep insisting on. */
    installAbandoned: computed(() => state.value.installAbandoned),
    /** The channel chosen at run time, or null when following the build's default. */
    channelOverride: computed(() => state.value.channelOverride),

    check,
    startDownload,
    installNativeUpdate,
    dismiss,
    init,
    cleanup,
    getCurrentBundle,
    setChannel,
    /** The channel every check asks: the runtime choice, else the build's default. */
    getChannel,
    clearChannel,
    /**
     * Asks the OS for location permission - never automatically, only when the
     * host app calls it. Resolves "granted", "denied", or "unavailable" (not
     * opted in, plugin missing, or Location off system-wide).
     */
    requestLocationPermission,
    /** Opens Android's Location settings screen, when `capacitor-native-settings` is installed. */
    openLocationSettings,
  };
}

/** @internal test hook - resets module state between cases. */
export function __resetUpdaterState(): void {
  listeners.length = 0;
  initialised = false;
  inflightCheck = null;
  checkErrorShown = false;
  launchingInstaller = false;
  resumedWhileLaunching = false;
  __resetPublishState();
  state.value = initialState() satisfies UpdaterState;
}
