import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { bucketFor, bucketKeys, fillBuckets } from "./buckets";
import { resolvePeriod, type Period } from "./period";

beforeAll(() => {
  vi.stubEnv("TZ", "Europe/Paris");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const NOW = () => new Date(2026, 9, 2, 14, 30);
const custom = (start: string, end: string): Period => ({ kind: "custom", start, end });

describe("bucketFor", () => {
  it("uses hours up to two days and days beyond", () => {
    expect(bucketFor({ days: 1 })).toBe("hour");
    expect(bucketFor({ days: 2 })).toBe("hour");
    expect(bucketFor({ days: 3 })).toBe("day");
  });
});

describe("bucketKeys", () => {
  it("lists every local day of a range", () => {
    const week = resolvePeriod({ kind: "preset", preset: "7d" }, NOW());
    expect(bucketKeys(week, "day")).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("lists 24 local hours of an ordinary day", () => {
    const keys = bucketKeys(resolvePeriod(custom("2026-09-30", "2026-09-30"), NOW()), "hour");
    expect(keys).toHaveLength(24);
    expect(keys[0]).toBe("2026-09-30T00");
    expect(keys[23]).toBe("2026-09-30T23");
  });

  it("follows DST: 23 hours in spring, one key for the repeated autumn hour", () => {
    const spring = bucketKeys(resolvePeriod(custom("2026-03-29", "2026-03-29"), NOW()), "hour");
    expect(spring).toHaveLength(23);
    expect(spring).not.toContain("2026-03-29T02");
    const autumn = bucketKeys({ start: new Date(2025, 9, 26), end: new Date(2025, 9, 27) }, "hour");
    expect(autumn).toHaveLength(24);
    expect(new Set(autumn).size).toBe(24);
    expect(
      bucketKeys(resolvePeriod(custom("2026-03-26", "2026-04-01"), NOW()), "day"),
    ).toHaveLength(7);
  });
});

describe("fillBuckets", () => {
  it("zero-fills every key and ignores rows outside the range", () => {
    const filled = fillBuckets(
      ["2026-09-30", "2026-10-01", "2026-10-02"],
      [
        { at: "2026-10-01", delivered: 2, check: 40 },
        { at: "2026-09-01", delivered: 9 },
        { at: "2026-10-02", failed: 1, check: Number.NaN },
      ],
      ["delivered", "failed", "check"] as const,
    );
    expect(filled).toEqual({
      delivered: [0, 2, 0],
      failed: [0, 0, 1],
      check: [0, 40, 0],
    });
  });
});
