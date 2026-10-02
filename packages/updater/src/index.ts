/**
 * @capuchoo/updater - the app-side runtime for Capuchoo updates.
 *
 * Framework-agnostic entry point. Vue applications should import
 * `@capuchoo/updater/vue` for the composable, and `@capuchoo/updater/capacitor`
 * from `capacitor.config.ts` for the plugin block.
 *
 * Minimum wiring for a Capacitor app:
 *
 *   // main.ts - before anything else, or the OTA plugin rolls back
 *   import { notifyAppReady } from "@capuchoo/updater";
 *   void notifyAppReady();
 *
 *   // capacitor bootstrap
 *   import { useUpdater } from "@capuchoo/updater/vue";
 *   await useUpdater().init();
 */

export {
  UpdateCheckBlockedError,
  UpdaterConfigError,
  buildCheckRequest,
  checkForUpdate,
  logUpdateEvent,
  reportUpdateEvent,
  type DeviceFacts,
} from "./api.service.js";

export {
  ChannelChangeError,
  clearChannel,
  getChannel,
  getChannelOverride,
  setChannel,
} from "./channel.service.js";

export {
  clearDeviceAttributes,
  getDeviceAttributes,
  setDeviceAttributes,
} from "./attributes.service.js";

export { HttpError, NetworkError } from "./http.js";

export { isExpiredLinkError, isTransientError } from "./check-errors.js";

export {
  ReleaseVerificationError,
  releaseClaim,
  verifyUpdateSignature,
  type SignatureVerdict,
} from "./release-verification.js";

export { ApkIntegrityError, checkApkIntegrity, type ApkIntegrity } from "./apk-integrity.js";

export { hashCachedFile, type ApkHash } from "./apk-hash.js";

export { Sha256 } from "./sha256.js";

export {
  MAX_FAILED_INSTALLS,
  isInstallAbandoned,
  settleInstall,
  type InstallRecord,
  type InstallSettlement,
} from "./install-attempts.js";

export {
  isSameArtefact,
  mergeUpdate,
  type MergeResult,
  type UpdateSource,
} from "./update-merge.js";

export { backoffDelay, withRetry, type RetryOptions, type RetryPolicy } from "./retry.js";

export {
  configureUpdater,
  describeConfigProblems,
  getUpdaterConfig,
  type UpdaterConfig,
} from "./config.js";

export {
  getBuiltinVersion,
  getBundleVersion,
  getDeviceId,
  getLocationFacts,
  getOsFacts,
  getPlatform,
  getPluginVersion,
  getVersionCode,
  isLocationServicesDisabledError,
  isNative,
  openLocationSettings,
  requestLocationPermission,
  type LocationPermissionResult,
} from "./device.js";

export {
  apkCacheFileName,
  discardCachedApk,
  downloadNativeUpdate,
  findCachedApk,
  pruneApkCache,
  type DownloadProgress,
} from "./download.service.js";

export {
  apkFileName,
  apksToDelete,
  cachePrefix,
  isCompleteDownload,
  parseApkFileName,
  type ApkIdentity,
  type CachedApk,
} from "./apk-cache.js";

export { openNativeInstaller } from "./install.service.js";

export { isDismissible, updateGate, type Gate, type GateFacts, type GateState } from "./gate.js";

export { applyOtaUpdate, discardBundle, getCurrentBundle, notifyAppReady } from "./ota.service.js";

// Re-exported so an app does not need a direct @capuchoo/core dependency just
// to type an update.
export type {
  DeviceAttributePatch,
  DeviceAttributes,
  Environment,
  Platform,
  ResolvedUpdate,
  UpdateCheckResponse,
  UpdateEvent,
  UpdateKind,
} from "@capuchoo/core";
