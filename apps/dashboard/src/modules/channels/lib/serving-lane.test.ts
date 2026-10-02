import { describe, expect, it } from "vite-plus/test";
import { bundle, native } from "@/shared/testing/fixtures";
import { bundleStatus, nativeStatus } from "./serving-lane";

describe("serving lane", () => {
  it("states the native build's SDK floor, or its absence", () => {
    expect(nativeStatus(null)).toEqual({ tone: "muted", text: "No native build yet" });
    expect(nativeStatus(native({ min_sdk: 24 }))?.text).toBe("min SDK 24");
    expect(nativeStatus(native())).toBeNull();
  });

  it("gates the bundle on the native build, warning when the channel's is too old", () => {
    expect(bundleStatus(null, null).text).toBe("No OTA bundle yet");
    expect(bundleStatus(bundle(), null).text).toBe("any native build");
    expect(bundleStatus(bundle({ min_native_version: 10 }), native({ version_code: 12 }))).toEqual({
      tone: "muted",
      text: "needs native ≥ 10",
    });
    expect(bundleStatus(bundle({ min_native_version: 14 }), native({ version_code: 12 }))).toEqual({
      tone: "warning",
      text: "needs native ≥ 14 · channel has 12",
    });
  });
});
