import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_RECORDING_POLICY,
  RECORDING_LIMITS,
  deviceSampleBucket,
  escalateMode,
  normaliseRecordingPatch,
  resolveRecordingPolicy,
} from "./recording-policy.js";

const NOW = 1_800_000_000_000;
const context = { deviceId: "device-a", now: NOW };

describe("resolveRecordingPolicy", () => {
  it("is the defaults with no rules", () => {
    const policy = resolveRecordingPolicy([], context);
    expect(policy.mode).toBe("off");
    expect(policy.tracks).toEqual(DEFAULT_RECORDING_POLICY.tracks);
    expect(policy.liveUntil).toBeNull();
    expect(policy.sampled).toBe(true);
  });

  it("applies app, then channel, then device, whatever order they arrive in", () => {
    const policy = resolveRecordingPolicy(
      [
        { scope: "device", patch: { mode: "session" } },
        { scope: "app", patch: { mode: "buffer", tracks: { network: false } } },
        { scope: "channel", patch: { mode: "off", flushMs: 2000 } },
      ],
      context,
    );
    expect(policy.mode).toBe("session");
    expect(policy.flushMs).toBe(2000);
    expect(policy.tracks.network).toBe(false);
    expect(policy.tracks.replay).toBe(true);
  });

  it("caps the mode at the ceiling", () => {
    const policy = resolveRecordingPolicy(
      [{ scope: "app", patch: { mode: "session", ceiling: "buffer" } }],
      context,
    );
    expect(policy.mode).toBe("buffer");
  });

  it("starts unsampled devices at off, but a device rule always samples", () => {
    const rate = deviceSampleBucket("device-a") / 2;
    const app = { scope: "app" as const, patch: { mode: "buffer" as const, sampleRate: rate } };

    expect(resolveRecordingPolicy([app], context)).toMatchObject({ mode: "off", sampled: false });
    expect(resolveRecordingPolicy([app, { scope: "device", patch: {} }], context)).toMatchObject({
      mode: "buffer",
      sampled: true,
    });
  });

  it("goes live until the deadline, and back once it passes", () => {
    const layers = [{ scope: "device" as const, patch: {}, liveUntil: NOW + 60_000 }];
    expect(resolveRecordingPolicy(layers, context)).toMatchObject({
      mode: "live",
      ceiling: "live",
      liveUntil: NOW + 60_000,
    });
    expect(resolveRecordingPolicy(layers, { ...context, now: NOW + 60_001 }).mode).toBe("off");
  });

  it("changes version exactly when the policy changes", () => {
    const a = resolveRecordingPolicy([{ scope: "app", patch: { mode: "buffer" } }], context);
    const b = resolveRecordingPolicy([{ scope: "app", patch: { mode: "buffer" } }], context);
    const c = resolveRecordingPolicy([{ scope: "app", patch: { mode: "session" } }], context);
    expect(a.version).toBe(b.version);
    expect(a.version).not.toBe(c.version);
  });

  it("clamps a stored patch that slipped past validation", () => {
    const policy = resolveRecordingPolicy(
      [{ scope: "app", patch: { flushMs: 1, pollMs: Number.MAX_SAFE_INTEGER } }],
      context,
    );
    expect(policy.flushMs).toBe(RECORDING_LIMITS.flushMs.min);
    expect(policy.pollMs).toBe(RECORDING_LIMITS.pollMs.max);
  });
});

describe("escalateMode", () => {
  it("raises up to the ceiling and never lowers", () => {
    expect(escalateMode("buffer", "live", "session")).toBe("session");
    expect(escalateMode("off", "session", "live")).toBe("session");
    expect(escalateMode("session", "buffer", "live")).toBe("session");
    expect(escalateMode("off", "session", "off")).toBe("off");
  });
});

describe("normaliseRecordingPatch", () => {
  it("keeps valid fields and reports refused ones", () => {
    const { patch, dropped } = normaliseRecordingPatch({
      mode: "loud",
      ceiling: "live",
      sampleRate: 4,
      triggers: ["shake", "nope"],
      tracks: { replay: false, bogus: true },
      database: { tables: ["orders", "drop table x"] },
      extra: 1,
    });
    expect(patch).toEqual({
      ceiling: "live",
      sampleRate: 1,
      triggers: ["shake"],
      tracks: { replay: false },
      database: { tables: ["orders"] },
    });
    expect(dropped).toEqual(["mode", "database.tables"]);
  });

  it("accepts every table", () => {
    expect(normaliseRecordingPatch({ database: { tables: "all" } }).patch).toEqual({
      database: { tables: "all" },
    });
  });

  it("is empty for anything but an object", () => {
    expect(normaliseRecordingPatch(null).patch).toEqual({});
    expect(normaliseRecordingPatch([1]).patch).toEqual({});
  });
});
