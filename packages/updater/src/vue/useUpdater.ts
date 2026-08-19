import type { PluginListenerHandle } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import type { ResolvedUpdate } from "@capucho/core";
import { computed, readonly, ref } from "vue";
import {
  UpdateCheckBlockedError,
  UpdaterConfigError,
  checkForUpdate,
  logUpdateEvent,
} from "../api.service.js";
import { getUpdaterConfig } from "../config.js";
import { isNative } from "../device.js";
import {
  cleanApkCache,
  downloadNativeUpdate,
  type DownloadProgress,
} from "../download.service.js";
import { openNativeInstaller } from "../install.service.js";
import { applyOtaUpdate, getCurrentBundle, notifyAppReady } from "../ota.service.js";

export interface UpdaterState {
  checking: boolean;
  downloading: boolean;
  installing: boolean;
  updateAvailable: boolean;
  currentUpdate: ResolvedUpdate | null;
  progress: DownloadProgress;
  /** Local path of a downloaded APK, ready to install. */
  cachedPath: string | null;
  error: string | null;
  /** Transient status for the current operation. */
  statusMessage: string;
  /** Result of the last check, shown when no update is pending. */
  lastCheckMessage: string;
}

const NO_PROGRESS: DownloadProgress = { loaded: 0, total: 0, percent: 0 };
const DONE_PROGRESS: DownloadProgress = { loaded: 100, total: 100, percent: 100 };

/**
 * Module-level state: one updater per app, shared by every component that calls
 * `useUpdater()`. Two independent copies would race over the same download.
 */
const state = ref<UpdaterState>({
  checking: false,
  downloading: false,
  installing: false,
  updateAvailable: false,
  currentUpdate: null,
  progress: { ...NO_PROGRESS },
  cachedPath: null,
  error: null,
  statusMessage: "",
  lastCheckMessage: "",
});

const listeners: PluginListenerHandle[] = [];
let initialised = false;

function publish(update: ResolvedUpdate): void {
  // A pending native update outranks an OTA bundle: the bundle may well be the
  // one that needs the new binary. Do not let a plugin event downgrade it.
  if (state.value.currentUpdate?.kind === "native" && update.kind === "ota") return;

  state.value.currentUpdate = update;
  state.value.updateAvailable = true;
  state.value.cachedPath = null;
  state.value.progress = { ...NO_PROGRESS };
  state.value.error = null;
  state.value.lastCheckMessage = `Version ${update.version} is available`;
}

async function attachPluginListeners(): Promise<void> {
  listeners.push(
    // Raised when the plugin's own background check finds a bundle. With
    // autoUpdate: "onlyDownload" it has already been fetched, so the id is
    // enough to apply it without downloading again.
    await CapacitorUpdater.addListener("updateAvailable", ({ bundle }) => {
      publish({
        kind: "ota",
        version: bundle.version,
        bundleId: bundle.id,
        required: false,
      });
    }),

    await CapacitorUpdater.addListener("download", ({ percent }) => {
      if (state.value.currentUpdate?.kind !== "ota") return;
      state.value.downloading = true;
      state.value.progress = { loaded: percent, total: 100, percent };
    }),

    await CapacitorUpdater.addListener("downloadComplete", ({ bundle }) => {
      if (state.value.currentUpdate?.kind !== "ota") return;
      state.value.downloading = false;
      state.value.currentUpdate.bundleId = bundle.id;
      state.value.progress = { ...DONE_PROGRESS };
      state.value.statusMessage = "Ready to install";
    }),

    await CapacitorUpdater.addListener("downloadFailed", () => {
      state.value.downloading = false;
      state.value.error = "The update could not be downloaded";
    }),

    await CapacitorUpdater.addListener("updateFailed", () => {
      const { appName } = getUpdaterConfig();
      state.value.error = `The update failed, so ${appName} restored the previous version`;
    }),
  );
}

/**
 * Checks for an update.
 *
 * @param silent suppresses console noise for background checks.
 * @returns whether an update is now pending.
 */
async function check(silent = false): Promise<boolean> {
  if (!isNative() || state.value.checking) return false;

  state.value.checking = true;
  state.value.error = null;
  state.value.lastCheckMessage = "";
  state.value.statusMessage = "Checking for updates...";

  try {
    const update = await checkForUpdate();

    if (update) {
      publish(update);
      await logUpdateEvent("check", update);
      return true;
    }

    if (!state.value.updateAvailable) {
      const { appName } = getUpdaterConfig();
      state.value.lastCheckMessage = `${appName} is up to date`;
    }
    return false;
  } catch (error) {
    // Configuration and channel errors are the developer's problem, not the
    // user's, but reporting "up to date" would hide them completely.
    if (error instanceof UpdaterConfigError) {
      state.value.error = "Updates are not configured for this build";
      console.error("[capucho]", error.problems.join("; "));
    } else if (error instanceof UpdateCheckBlockedError) {
      state.value.error = `The update service rejected this build: ${error.message}`;
      console.error("[capucho]", error.message, error.response);
    } else {
      state.value.error = "Could not reach the update service";
      if (!silent) console.error("[capucho] update check failed", error);
    }
    return false;
  } finally {
    state.value.checking = false;
    state.value.statusMessage = "";
  }
}

/** Downloads the pending update. For native updates, install is a second step. */
async function startDownload(): Promise<void> {
  const update = state.value.currentUpdate;
  if (!update || state.value.downloading || state.value.installing) return;

  state.value.error = null;

  // Already on disk - go straight to the installer.
  if (update.kind === "native" && state.value.cachedPath) {
    await installNativeUpdate();
    return;
  }

  state.value.downloading = true;
  state.value.statusMessage =
    update.kind === "native" ? "Downloading the new version..." : "Downloading update...";

  try {
    if (update.kind === "native") {
      state.value.cachedPath = await downloadNativeUpdate(update, (progress) => {
        state.value.progress = progress;
      });
      state.value.progress = { ...DONE_PROGRESS };
      state.value.statusMessage = "Download complete. Tap Install to continue.";
      await logUpdateEvent("download_complete", update);
      return;
    }

    // Reloads the WebView on success, so nothing below runs.
    await applyOtaUpdate(update);
  } catch (error) {
    state.value.error = error instanceof Error ? error.message : "The update failed";
    await logUpdateEvent("error", update, { error: state.value.error });
  } finally {
    state.value.downloading = false;
    if (!state.value.cachedPath) state.value.statusMessage = "";
  }
}

/** Hands the downloaded APK to the Android installer. */
async function installNativeUpdate(): Promise<void> {
  const update = state.value.currentUpdate;
  const path = state.value.cachedPath;
  if (!update || update.kind !== "native" || !path) return;

  state.value.installing = true;
  state.value.error = null;

  try {
    await openNativeInstaller(path);
    await logUpdateEvent("install", update);
  } catch (error) {
    state.value.error = error instanceof Error ? error.message : "Installation failed";
    await logUpdateEvent("error", update, { error: state.value.error });
  } finally {
    state.value.installing = false;
  }
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

  await notifyAppReady();
  await attachPluginListeners();
  await cleanApkCache();
  await check(true);
}

async function cleanup(): Promise<void> {
  await Promise.all(listeners.splice(0).map((listener) => listener.remove()));
  initialised = false;
}

/** Dismisses a pending update. Refuses for required updates and mid-download. */
async function dismiss(): Promise<void> {
  const update = state.value.currentUpdate;
  if (!update || update.required || state.value.downloading) return;

  await logUpdateEvent("cancel", update);
  state.value.updateAvailable = false;
  state.value.currentUpdate = null;
  state.value.cachedPath = null;
  state.value.statusMessage = "";
  state.value.progress = { ...NO_PROGRESS };
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
    statusMessage: computed(() => state.value.statusMessage),
    lastCheckMessage: computed(() => state.value.lastCheckMessage),
    /** True when the user may not postpone the update. */
    isRequired: computed(() => state.value.currentUpdate?.required === true),

    check,
    startDownload,
    installNativeUpdate,
    dismiss,
    init,
    cleanup,
    getCurrentBundle,
  };
}

/** @internal test hook - resets module state between cases. */
export function __resetUpdaterState(): void {
  listeners.length = 0;
  initialised = false;
  state.value = {
    checking: false,
    downloading: false,
    installing: false,
    updateAvailable: false,
    currentUpdate: null,
    progress: { ...NO_PROGRESS },
    cachedPath: null,
    error: null,
    statusMessage: "",
    lastCheckMessage: "",
  };
}
