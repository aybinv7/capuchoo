import { describe, expect, it } from "vite-plus/test";
import { buildDeviceRow, DEVICE_DIAGNOSTICS_COLUMNS } from "./telemetry";

const BASE = { appUuid: "app-1", deviceId: "device-1" };

describe("buildDeviceRow writes device diagnostics", () => {
  it("writes name, manufacturer, model and memory when known", () => {
    const row = buildDeviceRow(
      {
        ...BASE,
        deviceName: "Redmi Note 14",
        manufacturer: "Xiaomi",
        model: "24117RN76G",
        memUsedBytes: 19_952_352,
      },
      "2026-08-31T00:00:00Z",
    );

    expect(row.device_name).toBe("Redmi Note 14");
    expect(row.manufacturer).toBe("Xiaomi");
    expect(row.model).toBe("24117RN76G");
    expect(row.mem_used_bytes).toBe(19_952_352);
  });

  it("omits diagnostics fields the caller does not know, rather than nulling them", () => {
    // A stats call and an update check carry different subsets of device
    // state - omitting an unknown field preserves whatever an earlier,
    // better-informed call already stored, while writing null would blank it.
    const row = buildDeviceRow(BASE, "2026-08-31T00:00:00Z");

    expect("device_name" in row).toBe(false);
    expect("mem_used_bytes" in row).toBe(false);
  });
});

describe("buildDeviceRow writes location only as a complete pair", () => {
  it("writes latitude, longitude and a timestamp together", () => {
    const row = buildDeviceRow(
      { ...BASE, latitude: 36.75, longitude: 3.05, locationAccuracy: 12.5 },
      "2026-08-31T00:00:00Z",
    );

    expect(row.latitude).toBe(36.75);
    expect(row.longitude).toBe(3.05);
    expect(row.location_accuracy_m).toBe(12.5);
    expect(row.location_reported_at).toBe("2026-08-31T00:00:00Z");
  });

  /**
   * A latitude with no longitude is not a location. Writing one anyway would
   * put a point on a map that names half a place - checked here because the
   * client-side request builder makes the same guarantee, and a row that could
   * still end up with only one half would mean one of the two checks is dead
   * code.
   */
  it("writes neither when only one coordinate is present", () => {
    const withOnlyLat = buildDeviceRow({ ...BASE, latitude: 36.75 }, "2026-08-31T00:00:00Z");
    const withOnlyLng = buildDeviceRow({ ...BASE, longitude: 3.05 }, "2026-08-31T00:00:00Z");

    expect("latitude" in withOnlyLat).toBe(false);
    expect("longitude" in withOnlyLng).toBe(false);
  });

  it("writes no accuracy figure when the OS did not report one", () => {
    const row = buildDeviceRow({ ...BASE, latitude: 36.75, longitude: 3.05 }, "now");

    expect("location_accuracy_m" in row).toBe(false);
  });

  it("does not write a stale timestamp when there is no location", () => {
    const row = buildDeviceRow(BASE, "2026-08-31T00:00:00Z");

    expect("location_reported_at" in row).toBe(false);
  });
});

/**
 * The exact column list migration 009 adds, kept as one source of truth so the
 * tolerant-write retry in `deviceService.upsertDevice` strips precisely these
 * and nothing else when the migration has not run.
 */
describe("DEVICE_DIAGNOSTICS_COLUMNS names every column this migration adds", () => {
  it("matches what buildDeviceRow can write", () => {
    const row = buildDeviceRow(
      {
        ...BASE,
        deviceName: "x",
        manufacturer: "x",
        model: "x",
        memUsedBytes: 1,
        latitude: 1,
        longitude: 1,
        locationAccuracy: 1,
      },
      "now",
    );

    for (const column of Object.keys(row)) {
      if (["app_id", "device_id", "last_seen", "updated_at"].includes(column)) continue;
      if (
        [
          "platform",
          "channel_id",
          "channel_override",
          "version_name",
          "version_build",
          "version_os",
          "version_builtin",
          "plugin_version",
          "is_prod",
          "is_emulator",
          "custom_id",
        ].includes(column)
      ) {
        continue;
      }

      expect(DEVICE_DIAGNOSTICS_COLUMNS, column).toContain(column);
    }
  });
});
