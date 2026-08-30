import type { PluginListenerHandle } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import type { ResolvedUpdate } from "@capuchoo/core";
import { computed, readonly, ref } from "vue";
import {
  UpdateCheckBlockedError,
  UpdaterConfigError,
  checkForUpdate,
  logUpdateEvent,
} from "../api.service.js";
import { getUpdaterConfig } from "../config.js";
import { getVersionCode, isNative } from "../device.js";
import {
  downloadNativeUpdate,
  findCachedApk,
  pruneApkCache,
  type DownloadProgress,
} from "../download.service.js";
import { openNativeInstaller } from "../install.service.js";
import { applyOtaUpdate, getCurrentBundle, notifyAppReady } from "../ota.service.js";
import { canNotify, clearProgress, showProgress } from "../notification.service.js";

export interface UpdaterState {
  checking: boolean;
  downloading: boolean;
  installing: boolean;
  updateAvailable: boolean;
  currentUpdate: ResolvedUpdate | null;
  progress: DownloadProgress;
  /** Local path of a downloaded APK, ready to install. */
  cachedPath: string | null;
  /**
   * True once the APK has been handed to the Android package installer.
   *
   * Android shows its own confirmation dialog for a sideloaded APK and there is
   * no way around it - it is an OS security boundary, not a styling choice. The
   * handoff returns as soon as the intent is fired, long before the user has
   * decided, so `installing` flips back to false while that dialog is still on
   * screen and the prompt underneath reverted to offering an install the user
   * was already being asked about. This keeps the app honest about what it is
   * waiting for.
   */
  handedToInstaller: boolean;
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
  handedToInstaller: false,
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
  state.value.handedToInstaller = false;
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

      // A previous run may already have paid for this binary. Asking the
      // filesystem is what survives a restart; `cachedPath` alone does not, so
      // relaunching used to re-download a file that was already on disk.
      if (update.kind === "native") {
        state.value.cachedPath = await findCachedApk(update);
        if (state.value.cachedPath) {
          state.value.progress = { ...DONE_PROGRESS };
          state.value.statusMessage = "Ready to install.";
        }
      }

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
      console.error("[capuchoo]", error.problems.join("; "));
    } else if (error instanceof UpdateCheckBlockedError) {
      state.value.error = `The update service rejected this build: ${error.message}`;
      console.error("[capuchoo]", error.message, error.response);
    } else {
      state.value.error = "Could not reach the update service";
      if (!silent) console.error("[capuchoo] update check failed", error);
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

  // Asked for once, here, rather than at start-up: a permission prompt out of
  // context is one people decline, and an app that never downloads an update
  // should never see it at all.
  const notify = getUpdaterConfig().notifyProgress ? await canNotify() : false;

  try {
    if (update.kind === "native") {
      state.value.cachedPath = await downloadNativeUpdate(update, (progress) => {
        state.value.progress = progress;

        // The whole point of a backgrounded download: the app may not be on
        // screen, and a download with no visible sign of life gets cancelled.
        if (notify) {
          void showProgress({
            title: `Downloading ${getUpdaterConfig().appName} ${update.version}`,
            percent: progress.percent,
            body: `${progress.percent}%`,
          });
        }
      });
      state.value.progress = { ...DONE_PROGRESS };
      state.value.statusMessage = "Download complete. Tap Install to continue.";
      if (notify) await clearProgress();
      await logUpdateEvent("download_complete", update);
      return;
    }

    // Recorded *before* applying, because applying reloads the WebView and
    // nothing after this line ever runs. There is no "after" to report from.
    //
    // That is a real trade: if the apply fails, a delivery has been claimed for
    // an update that did not land. The catch below logs `error` in that case,
    // so the pair is visible, and the alternative is what this replaces -
    // recording no OTA delivery at all, ever. The plugin does not report these:
    // it only knows about its own auto-update flow, and this library exists
    // because the app drives updates itself.
    await logUpdateEvent("install", update);

    // Reloads the WebView on success, so nothing below runs.
    await applyOtaUpdate(update);
  } catch (error) {
    state.value.error = error instanceof Error ? error.message : "The update failed";
    // Cleared on failure too, or an ongoing notification outlives the download
    // it was reporting and sits there claiming progress forever.
    if (notify) await clearProgress();
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

    // Fired, not finished. Android now shows its own confirmation dialog and
    // there is no callback for what the user does with it, so the prompt has to
    // say what it is waiting for rather than silently offering the install
    // again underneath.
    state.value.handedToInstaller = true;
    state.value.statusMessage = "Confirm the installation to finish updating.";

    await logUpdateEvent("install", update);
  } catch (error) {
    state.value.handedToInstaller = false;
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

  // Start-up housekeeping, and nothing here may cost the check.
  //
  // It did once. `getVersionCode` was used below without being imported, so
  // this threw a ReferenceError; `initialised` was already true, the caller
  // discards the promise with `void`, and the result was an app that never
  // asked for updates at all - a required update sat published while the device
  // showed nothing and logged nothing. Reported by the device itself:
  //
  //   init THREW: getVersionCode is not defined
  //
  // The check now runs whatever happens above it, and a failure is loud.
  try {
    await notifyAppReady();
    await attachPluginListeners();

    // Delete APKs the device has outgrown. There is no callback from the
    // Android installer, so this is where an installed binary's 47 MB finally
    // goes: on the next launch the installed build number has passed it, which
    // says the install landed. Anything newer is left alone - it is an update
    // already downloaded and waiting, and deleting it would mean paying for it
    // twice.
    await pruneApkCache({ installedVersionCode: await getVersionCode() });
  } catch (error) {
    console.error("[capuchoo] updater start-up step failed", error);
  }

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
    /** True while Android's own install dialog is waiting on the user. */
    handedToInstaller: computed(() => state.value.handedToInstaller),

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
    handedToInstaller: false,
    error: null,
    statusMessage: "",
    lastCheckMessage: "",
  };
}
