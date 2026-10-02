import { describe, expect, it } from "vite-plus/test";
import { normalizeRollout } from "./normalize-rollout";

describe("normalizeRollout", () => {
  it("reads a full answer", () => {
    const rollout = normalizeRollout(
      {
        current: {
          bundle_id: "b-9",
          version: "1.9.1",
          delivered_at: "2026-09-29T08:00:00.000Z",
          delivered_by: "karim@example.com",
          from_version: "1.9.0",
          rollback: false,
        },
        devices: 22,
        on_current: 19,
        mix: [
          { version: "1.9.1", devices: 19, current: true },
          { version: "builtin", devices: 3, current: false },
          { devices: 1 },
        ],
        behind: [
          {
            id: "d-1",
            device_id: "abc",
            device_name: "Pixel",
            attributes: { rep: "K" },
            version_name: "1.9.0",
            last_seen_at: "2026-10-01T10:00:00.000Z",
          },
          { device_name: "no id" },
        ],
        curve: [
          { day: "2026-09-30", devices: 12 },
          { day: "2026-09-29", devices: 4 },
          { day: "yesterday", devices: 3 },
        ],
        tz: "Africa/Algiers",
      },
      { tz: "UTC" },
    );
    expect(rollout.current?.version).toBe("1.9.1");
    expect(rollout.mix).toHaveLength(2);
    expect(rollout.behind).toEqual([
      expect.objectContaining({ id: "d-1", platform: null, attributes: { rep: "K" } }),
    ]);
    expect(rollout.curve.map((point) => point.day)).toEqual(["2026-09-29", "2026-09-30"]);
    expect(rollout.tz).toBe("Africa/Algiers");
  });

  it("is total over an empty or contradictory body", () => {
    expect(normalizeRollout(null, { tz: "UTC" })).toEqual({
      current: null,
      devices: 0,
      on_current: 0,
      mix: [],
      behind: [],
      curve: [],
      tz: "UTC",
    });
    const rollout = normalizeRollout(
      { devices: 3, on_current: 9, current: { version: "1.0.0" } },
      { tz: "UTC" },
    );
    expect(rollout.on_current).toBe(3);
    expect(rollout.current).toBeNull();
  });
});
