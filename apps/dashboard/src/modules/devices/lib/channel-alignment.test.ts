import { describe, expect, it } from "vite-plus/test";
import { bundle, catalog, channel, native } from "@/shared/testing/fixtures";
import { nativeAlignment, otaAlignment } from "./channel-alignment";

const served = catalog({
  bundles: [bundle({ id: "b-2", version_name: "1.4.2" })],
  natives: [native({ id: "n-2", version_name: "1.4.0", version_code: 42 })],
});
const prod = channel({ current_bundle_id: "b-2", current_native_id: "n-2" });

describe("channel alignment", () => {
  it("says whether the device runs what the channel serves", () => {
    expect(otaAlignment("1.4.2", prod, served)).toEqual({ state: "current", served: "1.4.2" });
    expect(otaAlignment("1.4.1", prod, served)).toEqual({ state: "behind", served: "1.4.2" });
    expect(otaAlignment("1.5.0", prod, served)).toEqual({ state: "ahead", served: "1.4.2" });
    expect(otaAlignment("builtin", prod, served).state).toBe("behind");
    expect(otaAlignment("nightly", prod, served).state).toBe("behind");
    expect(nativeAlignment(42, prod, served)).toEqual({
      state: "current",
      served: "1.4.0 (42)",
    });
    expect(nativeAlignment(41, prod, served).state).toBe("behind");
    expect(nativeAlignment(43, prod, served).state).toBe("ahead");
  });

  it("is unknown when the channel serves nothing, is not loaded, or the device version is", () => {
    expect(otaAlignment("1.4.2", channel(), served).state).toBe("unknown");
    expect(otaAlignment("1.4.2", null, served).state).toBe("unknown");
    expect(otaAlignment(null, prod, served)).toEqual({ state: "unknown", served: "1.4.2" });
    expect(nativeAlignment(null, prod, served).state).toBe("unknown");
    expect(otaAlignment("1.4.2", prod, catalog()).state).toBe("unknown");
  });
});
