import { describe, expect, it } from "vite-plus/test";
import { buildDeviceRow, normalizeVersion, statsVersion } from "./telemetry";

const NOW = "2026-08-20T10:00:00.000Z";

describe("statsVersion", () => {
  it("reads version_name, the field the plugin sends", () => {
    expect(statsVersion({ version_name: "1.4.0" })).toBe("1.4.0");
  });

  it("falls back to version, which is all statsController forwards", () => {
    // This is the case that used to write "unknown" into every row.
    expect(statsVersion({ version: "1.4.0" })).toBe("1.4.0");
  });

  it("falls back to bundleId last", () => {
    expect(statsVersion({ bundleId: "1.4.0" })).toBe("1.4.0");
  });

  it("rejects the plugin's sentinels rather than storing them as a version", () => {
    expect(statsVersion({ version: "builtin" })).toBeNull();
    expect(statsVersion({ version_name: "unknown" })).toBeNull();
    expect(statsVersion({})).toBeNull();
  });
});

describe("normalizeVersion", () => {
  it("passes real versions through and drops non-versions", () => {
    expect(normalizeVersion("2.0.1")).toBe("2.0.1");
    expect(normalizeVersion("builtin")).toBeUndefined();
    expect(normalizeVersion("unknown")).toBeUndefined();
    expect(normalizeVersion("")).toBeUndefined();
    expect(normalizeVersion(undefined)).toBeUndefined();
  });
});

describe("buildDeviceRow", () => {
  it("always writes the identity and the timestamps", () => {
    expect(buildDeviceRow({ appUuid: "app-uuid", deviceId: "device-abc" }, NOW)).toEqual({
      app_id: "app-uuid",
      device_id: "device-abc",
      last_seen: NOW,
      updated_at: NOW,
    });
  });

  it("maps the camelCase observation onto the table's columns", () => {
    const row = buildDeviceRow(
      {
        appUuid: "app-uuid",
        deviceId: "device-abc",
        platform: "android",
        channelId: "channel-uuid",
        channelOverride: "staging",
        versionName: "1.4.0",
        versionBuild: "77",
        versionOs: "14",
        pluginVersion: "6.3.1",
        isProd: true,
        isEmulator: false,
        customId: "tester-1",
      },
      NOW,
    );

    expect(row).toEqual({
      app_id: "app-uuid",
      device_id: "device-abc",
      last_seen: NOW,
      updated_at: NOW,
      platform: "android",
      channel_id: "channel-uuid",
      channel_override: "staging",
      version_name: "1.4.0",
      version_build: "77",
      version_os: "14",
      plugin_version: "6.3.1",
      is_prod: true,
      is_emulator: false,
      custom_id: "tester-1",
    });
  });

  it("omits unknown fields so an upsert cannot blank what another call stored", () => {
    const row = buildDeviceRow(
      { appUuid: "app-uuid", deviceId: "device-abc", platform: "ios", versionName: undefined },
      NOW,
    );

    expect("version_name" in row).toBe(false);
    expect("plugin_version" in row).toBe(false);
    expect(row.platform).toBe("ios");
  });

  it("does not store 'builtin' as the device's version", () => {
    const row = buildDeviceRow(
      { appUuid: "app-uuid", deviceId: "device-abc", versionName: "builtin" },
      NOW,
    );

    expect("version_name" in row).toBe(false);
  });

  it("keeps is_emulator false, which is a value and not an absence", () => {
    const row = buildDeviceRow(
      { appUuid: "a", deviceId: "d", isEmulator: false, isProd: false },
      NOW,
    );

    expect(row.is_emulator).toBe(false);
    expect(row.is_prod).toBe(false);
  });
});

describe("buildDeviceRow: fields that arrive under snake_case names", () => {
  it("stores the OS version and custom id when the caller reports them", () => {
    const row = buildDeviceRow(
      {
        appUuid: "a",
        deviceId: "d",
        platform: "android",
        versionOs: "14",
        customId: "tester-1",
      },
      NOW,
    );

    // These were silently dropped: /api/update reads request.versionOs, and the
    // field normalizer had no version_os -> versionOs mapping, so a plugin
    // sending snake_case lost them between the wire and the row.
    expect(row.version_os).toBe("14");
    expect(row.custom_id).toBe("tester-1");
  });
});
