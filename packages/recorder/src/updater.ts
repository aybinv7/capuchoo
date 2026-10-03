import {
  getBundleVersion,
  getChannel,
  getDeviceId,
  getOsFacts,
  getPlatform,
  getUpdaterConfig,
  getVersionCode,
} from "@capuchoo/updater";
import type { RecorderIdentity } from "./recorder/types.js";

interface AppInfoBridge {
  Capacitor?: { Plugins?: { App?: { getInfo?: () => Promise<{ id?: string }> } } };
}

/** The bundle identifier the app was built with, which is how the server knows it. */
async function bundleIdentifier(): Promise<string> {
  try {
    return (await (globalThis as AppInfoBridge).Capacitor?.Plugins?.App?.getInfo?.())?.id ?? "";
  } catch {
    return "";
  }
}

/**
 * The identity the updater already resolves, so a session lines up with the device's update checks.
 * Without `VITE_APP_ID` the app's own bundle identifier is used, which is what the server matches.
 */
export function updaterIdentity(): () => Promise<RecorderIdentity> {
  return async () => {
    const config = getUpdaterConfig();
    const [appId, deviceId, versionName, versionCode, channel, os] = await Promise.all([
      config.appId || bundleIdentifier(),
      getDeviceId(),
      getBundleVersion(),
      getVersionCode(),
      getChannel(),
      getOsFacts().catch(() => null),
    ]);
    const platform = getPlatform();
    return {
      apiUrl: config.apiUrl,
      appId,
      deviceId,
      platform: platform === "ios" || platform === "android" ? platform : "web",
      versionName,
      versionCode: versionCode || null,
      channel: channel || null,
      device: {
        model: os?.model ?? null,
        manufacturer: os?.manufacturer ?? null,
        osVersion: os?.versionOs ?? null,
      },
    };
  };
}
