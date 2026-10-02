import { describe, expect, it } from "vite-plus/test";
import { fillDays, versionBars } from "./series";

describe("fillDays", () => {
  it("fills the window with zero days, oldest first", () => {
    const now = Date.parse("2026-09-30T15:00:00Z");
    const rows = fillDays(
      [{ day: "2026-09-29", checks: 4, installs: 2, failures: 1, devices: 3 }],
      3,
      now,
    );
    expect(rows.map((row) => row.day)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    expect(rows[1]?.installs).toBe(2);
    expect(rows[0]?.checks).toBe(0);
  });
});

describe("versionBars", () => {
  it("merges platforms and folds the tail", () => {
    const bars = versionBars(
      [
        { version: "1.0.0", platform: "android", devices: 5 },
        { version: "1.0.0", platform: "ios", devices: 3 },
        { version: "0.9.0", platform: "android", devices: 2 },
        { version: "0.8.0", platform: "android", devices: 1 },
      ],
      2,
    );
    expect(bars).toEqual([
      { version: "1.0.0", devices: 8, platforms: ["android", "ios"] },
      { version: "2 others", devices: 3, platforms: ["android"] },
    ]);
  });
});
