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
  /**
   * Base URL of the Capuchoo backend. No trailing slash needed.
   *
   * Typed as possibly undefined on purpose. Every real call site writes
   * `process.env.VITE_UPDATE_API_URL`, which is `string | undefined`, and
   * declaring it `string` only moved the failure from the type checker to a
   * `TypeError: Cannot read properties of undefined (reading 'replace')` in the
   * middle of `npx cap sync`.
   */
  apiUrl: string | undefined;
  /** Channel this build defaults to. */
  channel: string | undefined;
  /**
   * Version the plugin reports as its built-in bundle.
   *
   * Optional, and usually best left out. Omitted, the plugin reports the
   * binary's own `versionName`, which cannot go stale. Pass something only to
   * deliberately override that - and if it is wrong, the server compares
   * against the wrong baseline and re-serves bundles the device already has.
   */
  version?: string | undefined;
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
  /**
   * 7.50.2 also accepts "always", "off", "atBackground", "atInstall" and
   * "onLaunch". Only the two this package is written for are exposed - see
   * docs/CAPGO-PLUGIN.md for what each mode makes the plugin do on its own.
   */
  autoUpdate: boolean | "onlyDownload";
  updateUrl: string;
  statsUrl: string;
  channelUrl: string;
  defaultChannel: string;
  /**
   * Omitted when the app does not override it, so the plugin reports the
   * binary's own versionName - which cannot go stale.
   */
  version?: string;
  directUpdate: boolean;
  appReadyTimeout: number;
  responseTimeout: number;
  allowModifyUrl: boolean;
}

/** What each required option needs, and where it comes from. */
const REQUIRED: Array<{ key: "apiUrl" | "channel"; env: string; why: string }> = [
  { key: "apiUrl", env: "VITE_UPDATE_API_URL", why: "the server the app asks for updates" },
  { key: "channel", env: "VITE_UPDATE_CHANNEL", why: "the channel this build follows" },
];

export function capuchooUpdaterConfig(options: UpdaterPluginOptions): CapacitorUpdaterPluginConfig {
  // Validated before anything is read off `options`.
  //
  // This used to call `options.apiUrl.replace(...)` first and check afterwards,
  // so the helpful message below was unreachable for the one case that actually
  // happens: `process.env.VITE_UPDATE_API_URL` is `undefined` when unset, not
  // "". A bare `npx cap sync` died with "Cannot read properties of undefined
  // (reading 'replace')" and a stack inside node_modules, which says nothing
  // about the missing variable.
  //
  // Every missing value is named at once, because finding them one build at a
  // time is its own small misery.
  const missing = REQUIRED.filter(({ key }) => !options[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `capuchooUpdaterConfig: ${missing.map(({ key }) => key).join(" and ")} ` +
        `${missing.length === 1 ? "is" : "are"} missing.\n` +
        missing.map(({ key, env, why }) => `  ${key}  set ${env} - ${why}`).join("\n") +
        "\n\nThese come from the flavour's env file, which the Capuchoo CLI loads " +
        "during a deploy. A bare `npx cap sync` does not load it: either run the " +
        "deploy, or export the variables first.",
    );
  }

  const apiUrl = options.apiUrl!.replace(/\/+$/, "");

  if (!apiUrl) {
    // A URL of only slashes normalises to nothing. The plugin accepts an empty
    // updateUrl and then silently never checks for updates, which is the worst
    // possible outcome, so fail the build instead.
    throw new Error(
      `capuchooUpdaterConfig: apiUrl is "${options.apiUrl}", which is not a URL. ` +
        "Set VITE_UPDATE_API_URL for this flavour, otherwise the app ships with " +
        "updates disabled.",
    );
  }

  const mode = options.mode ?? "onlyDownload";

  return {
    // "manual" means the plugin does nothing on its own.
    autoUpdate: mode === "onlyDownload" ? "onlyDownload" : false,
    updateUrl: `${apiUrl}/api/update`,
    statsUrl: `${apiUrl}/api/stats`,
    channelUrl: `${apiUrl}/api/channel_self`,
    defaultChannel: options.channel!,
    ...(options.version ? { version: options.version } : {}),
    // The app shows a prompt and calls set() itself; letting the plugin apply
    // the bundle immediately would reload the WebView under the user.
    directUpdate: false,
    appReadyTimeout: options.appReadyTimeout ?? 10_000,
    responseTimeout: options.responseTimeout ?? 30_000,
    allowModifyUrl: options.allowModifyUrl ?? false,
  };
}
