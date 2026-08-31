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

describe("buildCheckRequest carries device diagnostics and location", () => {
  it("omits every diagnostic field the caller does not know", () => {
    const request = buildCheckRequest(FACTS);

    expect(request.deviceName).toBeUndefined();
    expect(request.manufacturer).toBeUndefined();
    expect(request.model).toBeUndefined();
    expect(request.memUsedBytes).toBeUndefined();
    expect(request.latitude).toBeUndefined();
    expect(request.longitude).toBeUndefined();
  });

  it("sends the diagnostics it has", () => {
    const request = buildCheckRequest({
      ...FACTS,
      deviceName: "Redmi Note 14",
      manufacturer: "Xiaomi",
      model: "24117RN76G",
      memUsedBytes: 19_952_352,
    });

    expect(request.deviceName).toBe("Redmi Note 14");
    expect(request.manufacturer).toBe("Xiaomi");
    expect(request.model).toBe("24117RN76G");
    expect(request.memUsedBytes).toBe(19_952_352);
  });

  it("sends memUsedBytes of 0 rather than treating it as absent", () => {
    // `if (facts.memUsedBytes)` would drop a genuine zero - unlikely in
    // practice, but the same class of bug as every other truthy check this
    // project has already been burned by.
    expect(buildCheckRequest({ ...FACTS, memUsedBytes: 0 }).memUsedBytes).toBe(0);
  });

  /**
   * A latitude with no longitude is not a location. `getLocationFacts` never
   * produces one without the other, but the request builder does not trust
   * that - it is the one place the wire format is decided, and a half
   * coordinate pair on the wire is worse than none.
   */
  it("never sends a latitude without a longitude, or the reverse", () => {
    expect(buildCheckRequest({ ...FACTS, latitude: 36.75 }).latitude).toBeUndefined();
    expect(buildCheckRequest({ ...FACTS, longitude: 3.05 }).longitude).toBeUndefined();
  });

  it("sends a complete location, with accuracy when known", () => {
    const request = buildCheckRequest({
      ...FACTS,
      latitude: 36.75,
      longitude: 3.05,
      locationAccuracy: 12.5,
    });

    expect(request.latitude).toBe(36.75);
    expect(request.longitude).toBe(3.05);
    expect(request.locationAccuracy).toBe(12.5);
  });

  it("sends a location with no accuracy figure at all, rather than a fake one", () => {
    const request = buildCheckRequest({ ...FACTS, latitude: 36.75, longitude: 3.05 });

    expect(request.locationAccuracy).toBeUndefined();
  });
});
