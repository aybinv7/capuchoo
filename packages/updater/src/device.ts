import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";

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
 * OS version and emulator flag, from `@capacitor/device`.
 *
 * That package is an *optional* peer: it is a separate install, and an app that
 * does not have it should still be able to check for updates. So it is imported
 * dynamically and every failure - not installed, not registered, throwing on an
 * odd platform - resolves to `undefined`, which the request builder omits.
 */
export async function getOsFacts(): Promise<{ versionOs?: string; isEmulator?: boolean }> {
  if (!Capacitor.isNativePlatform()) return {};

  try {
    const { Device } = await import("@capacitor/device");
    const info = await Device.getInfo();
    return {
      ...(info.osVersion ? { versionOs: info.osVersion } : {}),
      ...(typeof info.isVirtual === "boolean" ? { isEmulator: info.isVirtual } : {}),
    };
  } catch {
    return {};
  }
}
