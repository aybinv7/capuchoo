import { describe, expect, it } from "vite-plus/test";
import { buildCheckRequest, type DeviceFacts } from "./api.service.js";

const FACTS: DeviceFacts = {
  appId: "com.ayb.lowmaro.staging",
  platform: "android",
  channel: "staging",
  isProd: false,
  versionCode: 77,
  versionName: "4.0.0",
  deviceId: "device-abc",
};

describe("buildCheckRequest", () => {
  it("always sends what the server decides with", () => {
    expect(buildCheckRequest(FACTS)).toEqual({
      appId: "com.ayb.lowmaro.staging",
      platform: "android",
      channel: "staging",
      defaultChannel: "staging",
      versionCode: "77",
      versionBuild: "77",
      version_name: "4.0.0",
      deviceId: "device-abc",
      isProd: false,
    });
  });

  it("sends the real build number, as a string, under both names", () => {
    const request = buildCheckRequest({ ...FACTS, versionCode: 0 });

    // 0 off-device is honest. The old implementation sent 999999 on web, so a
    // browser session claimed to be newer than every published release.
    expect(request.versionCode).toBe("0");
    expect(request.versionBuild).toBe("0");
  });

  it("includes the device facts when the app could determine them", () => {
    const request = buildCheckRequest({
      ...FACTS,
      pluginVersion: "8.51.8",
      versionOs: "14",
      isEmulator: false,
      customId: "qa-tablet",
    });

    expect(request.pluginVersion).toBe("8.51.8");
    expect(request.versionOs).toBe("14");
    expect(request.isEmulator).toBe(false);
    expect(request.customId).toBe("qa-tablet");
  });

  it("omits what it could not determine, rather than sending a placeholder", () => {
    const request = buildCheckRequest(FACTS);

    // The server writes only the keys it receives, so an empty string here
    // would overwrite a value an earlier, better-informed check had stored.
    expect("pluginVersion" in request).toBe(false);
    expect("versionOs" in request).toBe(false);
    expect("isEmulator" in request).toBe(false);
    expect("customId" in request).toBe(false);
  });

  it("keeps isEmulator false, which is an answer and not an absence", () => {
    expect(buildCheckRequest({ ...FACTS, isEmulator: false }).isEmulator).toBe(false);
  });

  it("omits the channel entirely when the app has none, letting the server default", () => {
    const request = buildCheckRequest({ ...FACTS, channel: undefined });

    expect("channel" in request).toBe(false);
    expect("defaultChannel" in request).toBe(false);
  });
});
