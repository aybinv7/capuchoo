/**
 * @capucho/updater - the app-side runtime for Capucho updates.
 *
 * Framework-agnostic entry point. Vue applications should import
 * `@capucho/updater/vue` for the composable, and `@capucho/updater/capacitor`
 * from `capacitor.config.ts` for the plugin block.
 *
 * Minimum wiring for a Capacitor app:
 *
 *   // main.ts - before anything else, or the OTA plugin rolls back
 *   import { notifyAppReady } from "@capucho/updater";
 *   void notifyAppReady();
 *
 *   // capacitor bootstrap
 *   import { useUpdater } from "@capucho/updater/vue";
 *   await useUpdater().init();
 */

export {
  UpdateCheckBlockedError,
  UpdaterConfigError,
  checkForUpdate,
  logUpdateEvent,
} from "./api.service.js";

export {
  configureUpdater,
  describeConfigProblems,
  getUpdaterConfig,
  type UpdaterConfig,
} from "./config.js";

export { getBundleVersion, getDeviceId, getPlatform, getVersionCode, isNative } from "./device.js";

export { cleanApkCache, downloadNativeUpdate, type DownloadProgress } from "./download.service.js";

export { openNativeInstaller } from "./install.service.js";

export { applyOtaUpdate, discardBundle, getCurrentBundle, notifyAppReady } from "./ota.service.js";

// Re-exported so an app does not need a direct @capucho/core dependency just
// to type an update.
export type {
  Environment,
  Platform,
  ResolvedUpdate,
  UpdateCheckResponse,
  UpdateEvent,
  UpdateKind,
} from "@capucho/core";
