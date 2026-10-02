import { describe, expect, it } from "vite-plus/test";
import { alignmentStatus, channelHint, otaLabel } from "./release-lane";

describe("release lane", () => {
  it("says where a version stands against its channel", () => {
    expect(alignmentStatus({ state: "current", served: "1.4.2" })).toEqual({
      tone: "success",
      text: "on channel",
    });
    expect(alignmentStatus({ state: "behind", served: "1.4.2" })?.text).toBe(
      "behind · channel 1.4.2",
    );
    expect(alignmentStatus({ state: "ahead", served: "1.4.2" })?.tone).toBe("info");
    expect(alignmentStatus({ state: "unknown", served: null })).toBeNull();
    expect(alignmentStatus({ state: "unknown", served: "1.4.2" })?.tone).toBe("muted");
  });

  it("reads the built-in sentinel", () => {
    expect(otaLabel("builtin")).toBe("built-in");
    expect(otaLabel("1.4.2")).toBe("1.4.2");
    expect(otaLabel(null)).toBeNull();
  });

  it("hints an assignment before a build's own channel", () => {
    const device = {
      assigned_channel_id: null,
      assigned_channel: null,
      reported_channel: "staging",
      channel_name: "production",
    };
    expect(channelHint(device, "production")).toBe("build says staging");
    expect(channelHint({ ...device, reported_channel: "production" }, "production")).toBeNull();
    expect(channelHint({ ...device, assigned_channel_id: "c-1" }, "production")).toBe(
      "assigned from the dashboard",
    );
  });
});
