import { DEFAULT_RECORDING_POLICY } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import { clearPatch, hasPath, mergePolicy, readPath, samePatch, writePatch } from "./policy-form";

describe("policy form paths", () => {
  it("writes and clears top-level and grouped fields without touching siblings", () => {
    let patch = writePatch({}, "mode", "buffer");
    patch = writePatch(patch, "tracks.network", false);
    patch = writePatch(patch, "tracks.replay", false);
    expect(patch).toEqual({ mode: "buffer", tracks: { network: false, replay: false } });
    expect(hasPath(patch, "tracks.network")).toBe(true);

    patch = clearPatch(patch, "tracks.network");
    expect(patch).toEqual({ mode: "buffer", tracks: { replay: false } });
    patch = clearPatch(patch, "tracks.replay");
    expect(patch).toEqual({ mode: "buffer" });
    expect(clearPatch(patch, "mode")).toEqual({});
  });

  it("merges a patch over a base, group by group", () => {
    const merged = mergePolicy(DEFAULT_RECORDING_POLICY, {
      mode: "session",
      tracks: { perf: false },
      buffer: { maxMs: 60_000 },
    });
    expect(merged.mode).toBe("session");
    expect(merged.tracks).toEqual({ ...DEFAULT_RECORDING_POLICY.tracks, perf: false });
    expect(merged.buffer).toEqual({ ...DEFAULT_RECORDING_POLICY.buffer, maxMs: 60_000 });
    expect(readPath(merged, "network.bodies")).toBe(false);
  });

  it("compares patches regardless of key order", () => {
    expect(
      samePatch(
        { mode: "off", tracks: { replay: true, perf: false } },
        {
          tracks: { perf: false, replay: true },
          mode: "off",
        },
      ),
    ).toBe(true);
    expect(samePatch({ mode: "off" }, { mode: "buffer" })).toBe(false);
  });
});
