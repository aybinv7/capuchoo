import { describe, expect, it } from "vite-plus/test";
import type { Device } from "../types/devices.types";
import { findListedDevice } from "./listed-device";

const device = { id: "uuid-1", device_id: "android-abc" } as Device;

describe("findListedDevice", () => {
  it("finds the row in a paged devices table and marks the detail fields as missing", () => {
    const entries = [
      [["apps", "a", "devices", { palette: true }], { devices: [device], total: 1 }],
      [["apps", "a", "devices", {}], { pages: [{ devices: [], total: 1 }, { devices: [device] }] }],
    ] as const;
    expect(findListedDevice(entries, "uuid-1")).toEqual({
      ...device,
      channel: null,
      assigned_channel: null,
      summary: null,
    });
  });

  it("ignores the palette's partial rows and anything malformed", () => {
    const entries = [
      [["k"], { devices: [device], total: 1 }],
      [["k"], { pages: "nope" }],
      [["k"], undefined],
    ] as const;
    expect(findListedDevice(entries, "uuid-1")).toBeUndefined();
  });
});
