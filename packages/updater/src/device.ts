import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { getUpdaterConfig } from "./config.js";
import { diagnosticPlugins } from "./optional-plugins.js";

/**
 * Facts about the running build that the server needs in order to decide
 * whether an update applies.
 */

/**
 * Native build number of the installed binary.
 *
 * Returns 0 off-device. The old implementation returned 999999 on web, which
 * meant a browser session claimed to be newer than every published release and
 * so never saw an update - masking the very bug you would be debugging.
 */
export async function getVersionCode(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;

  try {
    const info = await App.getInfo();
    return Number.parseInt(info.build, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Semantic version of the web bundle currently applied.
 *
 * `"builtin"` means no OTA bundle has been applied yet and the app is running
 * the assets compiled into the binary. The server treats it as 0.0.0, so it
 * must be reported honestly rather than sent as a constant.
 */
export async function getBundleVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "builtin";

  try {
    const current = await CapacitorUpdater.current();
    return current.bundle.version || "builtin";
  } catch {
    return "builtin";
  }
}

/**
 * Stable per-install identifier, supplied by the OTA plugin.
 *
 * The plugin persists this natively. Reading `localStorage.device_id` instead -
 * as the app template did - returns null on a fresh install and is wiped
 * whenever the WebView data is cleared, so channel overrides and per-device
 * stats silently stopped working.
 */
export async function getDeviceId(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "web";

  try {
    const { deviceId } = await CapacitorUpdater.getDeviceId();
    return deviceId || "unknown";
  } catch {
    return "unknown";
  }
}

export function getPlatform(): "android" | "ios" | "web" {
  return Capacitor.getPlatform() as "android" | "ios" | "web";
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Version of the OTA plugin the app is running.
 *
 * Useful when a device misbehaves: plugin version explains more failures than
 * app version does.
 */
export async function getPluginVersion(): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;

  try {
    const { version } = await CapacitorUpdater.getPluginVersion();
    return version || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bundle version compiled into the binary.
 *
 * Distinct from `getBundleVersion()`, which reports the OTA bundle currently
 * applied - that one says `"builtin"` when none has been, and this says which
 * builtin that is.
 */
export async function getBuiltinVersion(): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) return undefined;

  try {
    const { version } = await CapacitorUpdater.getBuiltinVersion();
    return version || undefined;
  } catch {
    return undefined;
  }
}

/**
 * OS version, emulator flag and device diagnostics, from `@capacitor/device`.
 *
 * That package is an *optional* peer, reached through `diagnosticPlugins.device()`
 * rather than a literal `import("@capacitor/device")`. The literal form is
 * statically analysable, so a bundler fails the *build* of any app that has not
 * installed it - the same defect `optional-plugins.ts` documents at length for
 * the native-update path, reproduced here because this function predates that
 * fix and nothing had touched it since. `@capacitor/device` is in this
 * project's own `OPTIONAL_PACKAGES` guard now specifically so it cannot happen
 * a second time.
 *
 * Every failure - not installed, not registered, throwing on an odd platform -
 * resolves to `{}`, which the request builder omits field by field.
 *
 * `memUsed` is the app's own memory footprint, not total device RAM, and is
 * named `memUsedBytes` on the wire for that reason. Total RAM and free/total
 * device storage are not included: `@capacitor/device` in the version range
 * this project supports does not report either, and there is no other
 * officially supported plugin in the dependency set that does.
 */
export async function getOsFacts(): Promise<{
  versionOs?: string;
  isEmulator?: boolean;
  deviceName?: string;
  manufacturer?: string;
  model?: string;
  memUsedBytes?: number;
}> {
  if (!Capacitor.isNativePlatform()) return {};

  try {
    const Device = diagnosticPlugins.device();
    if (!Device) return {};

    const info = await Device.getInfo();
    return {
      ...(info.osVersion ? { versionOs: info.osVersion } : {}),
      ...(typeof info.isVirtual === "boolean" ? { isEmulator: info.isVirtual } : {}),
      ...(info.name ? { deviceName: info.name } : {}),
      ...(info.manufacturer ? { manufacturer: info.manufacturer } : {}),
      ...(info.model ? { model: info.model } : {}),
      ...(typeof info.memUsed === "number" ? { memUsedBytes: info.memUsed } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * On-device GPS, sent only when the app has opted in and permission is
 * already granted.
 *
 * Two gates, both load-bearing:
 *
 *  1. `collectLocation` on the updater config. Precise location is personal
 *     data, and collecting it is a decision the *host app* makes explicitly -
 *     never a default this library turns on for anyone who installs the peer.
 *  2. `checkPermissions()`, never `requestPermissions()`. A background update
 *     check that popped a system location prompt out of nowhere would be
 *     indistinguishable from malware. Asking is `requestLocationPermission()`,
 *     exported separately, so the *app* decides when - onboarding, a settings
 *     toggle - never this function.
 *
 * Best effort like everything else here: any failure, including "permission
 * not yet granted", resolves to `{}`.
 */
export async function getLocationFacts(): Promise<{
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
}> {
  if (!Capacitor.isNativePlatform()) return {};
  if (!getUpdaterConfig().collectLocation) return {};

  try {
    const Geolocation = diagnosticPlugins.geolocation();
    if (!Geolocation) return {};

    const status = await Geolocation.checkPermissions();
    if (status.location !== "granted" && status.coarseLocation !== "granted") return {};

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10_000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      ...(typeof position.coords.accuracy === "number"
        ? { locationAccuracy: position.coords.accuracy }
        : {}),
    };
  } catch {
    return {};
  }
}

/**
 * `@capacitor/geolocation` throws rather than returning a denied status when
 * the OS's Location toggle itself is off - `checkPermissions` and
 * `requestPermissions` both do this, undocumented, and the message is the only
 * way to tell it apart from an actual refusal:
 *
 *   Error: Location services are not enabled.
 *   code: OS-PLUG-GLOC-0007
 *
 * Found by testing this on a real device rather than assuming the API
 * matched its types: the phone had Location off, `requestLocationPermission`
 * reported "denied", and the user never saw a system prompt at all - which
 * looks exactly like a permission problem this app cannot fix, when the actual
 * fix is "turn Location on in Settings".
 *
 * Exported and pure so the distinction is under test without a device.
 */
export function isLocationServicesDisabledError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === "OS-PLUG-GLOC-0007") return true;

  const message = error instanceof Error ? error.message : String(error);
  return /location services/i.test(message) && /not enabled|disabled/i.test(message);
}

export type LocationPermissionResult = "granted" | "denied" | "unavailable";

/**
 * Asks the OS for location permission, and only the OS - this never runs
 * automatically. Call it from wherever the host app has decided to explain why
 * it wants location (onboarding, a settings screen), not from a background
 * check.
 *
 * "unavailable" without prompting when the app has not opted in via
 * `collectLocation`, when `@capacitor/geolocation` is not installed, or when
 * the OS's Location service is off system-wide - none of those are the user
 * refusing anything, and telling them apart from "denied" is the point of not
 * just returning a boolean.
 */
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  if (!Capacitor.isNativePlatform()) return "unavailable";
  if (!getUpdaterConfig().collectLocation) return "unavailable";

  try {
    const Geolocation = diagnosticPlugins.geolocation();
    if (!Geolocation) return "unavailable";

    const status = await Geolocation.requestPermissions();
    return status.location === "granted" || status.coarseLocation === "granted"
      ? "granted"
      : "denied";
  } catch (error) {
    return isLocationServicesDisabledError(error) ? "unavailable" : "denied";
  }
}
