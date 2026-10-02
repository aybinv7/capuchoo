import { describe, expect, it } from "vite-plus/test";
import { segmentFill, versionMix } from "./version-mix";

describe("versionMix", () => {
  const rows = [
    { version: "1.8.0", devices: 2, current: false },
    { version: "other", devices: 1, current: false },
    { version: "1.9.1", devices: 12, current: true },
    { version: "builtin", devices: 3, current: false },
    { version: "1.9.0", devices: 4, current: false },
    { version: "2.0.0", devices: 1, current: false },
    { version: "1.7.0", devices: 0, current: false },
  ];

  it("orders current, ahead, behind newest first, built-in, then the tail", () => {
    expect(versionMix(rows, "1.9.1").map((segment) => [segment.version, segment.tone])).toEqual([
      ["1.9.1", "current"],
      ["2.0.0", "ahead"],
      ["1.9.0", "behind"],
      ["1.8.0", "behind"],
      ["builtin", "builtin"],
      ["other", "other"],
    ]);
  });

  it("colours the current version primary and fades older ones", () => {
    const [current, ahead, newer, older, builtin, other] = versionMix(rows, "1.9.1");
    expect(current?.color).toBe("var(--primary)");
    expect(ahead?.color).toBe("var(--info)");
    expect(newer?.color).toContain("62%");
    expect(older?.color).toContain("52%");
    expect(builtin?.hatched).toBe(true);
    expect(builtin?.label).toBe("built-in");
    expect(other?.color).toBe("var(--border)");
  });

  it("shares devices over the mix and survives an empty one", () => {
    const [current] = versionMix(rows, "1.9.1");
    expect(current?.share).toBeCloseTo(12 / 23, 5);
    expect(versionMix([], "1.9.1")).toEqual([]);
  });

  it("trusts the server's current flag, and treats every version as behind without one", () => {
    expect(versionMix(rows, null)[0]?.version).toBe("1.9.1");
    const unflagged = rows.map((row) => ({ ...row, current: false }));
    expect(versionMix(unflagged, null)[0]).toMatchObject({ version: "2.0.0", tone: "behind" });
  });

  it("hatches built-in in its fill", () => {
    expect(segmentFill({ color: "red", hatched: false })).toBe("red");
    expect(segmentFill({ color: "red", hatched: true })).toContain("repeating-linear-gradient");
  });
});
