/**
 * Builds the `CapacitorUpdater` plugin block for `capacitor.config.ts`.
 *
 * This exists because the plugin's `autoUpdate` mode has to agree with how the
 * app drives updates, and getting it wrong fails in a way that is very hard to
 * diagnose. The app template shipped `autoUpdate: true` while also calling
 * `download()` and `set()` from JavaScript: the plugin applied bundles on its
 * own schedule at the same time as the UI was downloading them, so a device
 * could download the same bundle twice, or reload mid-prompt.
 *
 * `"onlyDownload"` is the mode this package is written for. The plugin fetches
 * the bundle in the background and raises `updateAvailable`; the app decides
 * when to apply it. Pass `mode: "manual"` to disable background downloads
 * entirely and drive everything from `useUpdater`.
 *
 * Imported from `capacitor.config.ts`, so it must stay free of any runtime or
 * DOM dependency.
 */

export type UpdaterMode = "onlyDownload" | "manual";

export interface UpdaterPluginOptions {
  /** Base URL of the Capucho backend. No trailing slash needed. */
  apiUrl: string;
  /** Channel this build defaults to. */
  channel: string;
  /**
   * Version the plugin reports as the built-in bundle. Pass the app's
   * package.json version - if this is stale, the server compares against the
   * wrong baseline and re-serves bundles the device already has.
   */
  version: string;
  mode?: UpdaterMode;
  /** Milliseconds the plugin waits for `notifyAppReady` before rolling back. */
  appReadyTimeout?: number;
  responseTimeout?: number;
  /**
   * Whether the app may point the plugin at a different server at runtime.
   * Leave off in production: it lets anything running in the WebView redirect
   * update downloads.
   */
  allowModifyUrl?: boolean;
}

export interface CapacitorUpdaterPluginConfig {
  autoUpdate: boolean | "onlyDownload";
  updateUrl: string;
  statsUrl: string;
  channelUrl: string;
  defaultChannel: string;
  version: string;
  directUpdate: boolean;
  appReadyTimeout: number;
  responseTimeout: number;
  allowModifyUrl: boolean;
}

export function capuchoUpdaterConfig(options: UpdaterPluginOptions): CapacitorUpdaterPluginConfig {
  const apiUrl = options.apiUrl.replace(/\/+$/, "");

  if (!apiUrl) {
    // The plugin accepts an empty updateUrl and then silently never checks for
    // updates, which is the worst possible outcome. Fail the build instead.
    throw new Error(
      "capuchoUpdaterConfig: apiUrl is empty. Set VITE_UPDATE_API_URL for this " +
        "flavour before building, otherwise the app ships with updates disabled.",
    );
  }

  const mode = options.mode ?? "onlyDownload";

  return {
    // "manual" means the plugin does nothing on its own.
    autoUpdate: mode === "onlyDownload" ? "onlyDownload" : false,
    updateUrl: `${apiUrl}/api/update`,
    statsUrl: `${apiUrl}/api/stats`,
    channelUrl: `${apiUrl}/api/channel_self`,
    defaultChannel: options.channel,
    version: options.version,
    // The app shows a prompt and calls set() itself; letting the plugin apply
    // the bundle immediately would reload the WebView under the user.
    directUpdate: false,
    appReadyTimeout: options.appReadyTimeout ?? 10_000,
    responseTimeout: options.responseTimeout ?? 30_000,
    allowModifyUrl: options.allowModifyUrl ?? false,
  };
}
