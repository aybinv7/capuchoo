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

/** The identity the updater already resolves, so a session lines up with the device's update checks. */
export function updaterIdentity(): () => Promise<RecorderIdentity> {
  return async () => {
    const config = getUpdaterConfig();
    const [deviceId, versionName, versionCode, channel, os] = await Promise.all([
      getDeviceId(),
      getBundleVersion(),
      getVersionCode(),
      getChannel(),
      getOsFacts().catch(() => null),
    ]);
    const platform = getPlatform();
    return {
      apiUrl: config.apiUrl,
      appId: config.appId,
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
