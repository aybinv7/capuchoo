import { describe, expect, it } from "vite-plus/test";
import { errorRate, versionSpike } from "./recording-quality.js";

const row = (version: string, sessions: number, errors: number, devices = 3) => ({
  version,
  sessions,
  error_sessions: errors,
  devices,
  last_seen: "2026-10-04T10:00:00Z",
});

describe("release quality", () => {
  it("reads a version's error rate, and none without sessions", () => {
    expect(errorRate(row("1.0.0", 8, 2))).toBe(0.25);
    expect(errorRate(row("1.0.0", 0, 0))).toBeNull();
  });

  it("flags the newest version when its errors jump past the earlier ones", () => {
    expect(versionSpike([row("1.2.0", 10, 5), row("1.1.0", 20, 2), row("1.0.0", 10, 1)])).toEqual({
      version: "1.2.0",
      rate: 0.5,
      baseline: 0.1,
      sessions: 10,
      devices: 3,
    });
  });

  it("stays quiet on a small rise, a small sample, or a single version", () => {
    expect(versionSpike([row("1.2.0", 10, 2), row("1.1.0", 20, 3)])).toBeNull();
    expect(versionSpike([row("1.2.0", 4, 4), row("1.1.0", 20, 0)])).toBeNull();
    expect(versionSpike([row("1.2.0", 30, 20)])).toBeNull();
    expect(versionSpike([])).toBeNull();
  });
});
