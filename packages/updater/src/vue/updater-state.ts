import type { ResolvedUpdate } from "@capuchoo/core";
import { ref } from "vue";
import type { DownloadProgress } from "../download.service.js";

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
   * True once the APK has been handed to the Android package installer, until
   * the app is back in front and the installed build number says what happened.
   */
  handedToInstaller: boolean;
  /** Failed installs of the current native version, counted across launches. */
  installFailures: number;
  /** The current native version failed to install too often to keep insisting on. */
  installAbandoned: boolean;
  /** User-facing problem: a server refusal, or a download, install or verification failure. */
  error: string | null;
  /**
   * Why the last check got no answer - offline, timed out, a 5xx. Diagnostic
   * only; it never reaches the prompt, and the next check retries.
   */
  lastCheckError: string | null;
  /** Epoch milliseconds of the last check the server answered. */
  lastCheckedAt: number | null;
  /** The channel chosen at run time, or null when following the build's default. */
  channelOverride: string | null;
  /** Transient status for the current operation. */
  statusMessage: string;
  /** Result of the last check, shown when no update is pending. */
  lastCheckMessage: string;
}

export const NO_PROGRESS: DownloadProgress = { loaded: 0, total: 0, percent: 0 };
export const DONE_PROGRESS: DownloadProgress = { loaded: 100, total: 100, percent: 100 };

/** A fresh state, as on first launch. */
export function initialState(): UpdaterState {
  return {
    checking: false,
    downloading: false,
    installing: false,
    updateAvailable: false,
    currentUpdate: null,
    progress: { ...NO_PROGRESS },
    cachedPath: null,
    handedToInstaller: false,
    installFailures: 0,
    installAbandoned: false,
    error: null,
    lastCheckError: null,
    lastCheckedAt: null,
    channelOverride: null,
    statusMessage: "",
    lastCheckMessage: "",
  };
}

/** One updater per app, shared by every `useUpdater()` caller: two copies would race one download. */
export const state = ref<UpdaterState>(initialState());

/** Whether an artefact is mid-flight and must not be swapped out from under the user. */
export function isBusy(): boolean {
  return state.value.downloading || state.value.installing || state.value.handedToInstaller;
}
