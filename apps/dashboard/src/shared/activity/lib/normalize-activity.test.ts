import { describe, expect, it } from "vite-plus/test";
import { toCategory } from "./categories";
import { normalizeActivity } from "./normalize-activity";

describe("normalizeActivity", () => {
  const asked = {
    from: "2026-09-26T00:00:00.000Z",
    to: "2026-10-03T00:00:00.000Z",
    bucket: "day" as const,
    tz: "Africa/Algiers",
  };

  it("reads totals and buckets, dropping what it cannot place", () => {
    const activity = normalizeActivity(
      {
        ...asked,
        totals: { check: 40, delivered: 2, failed: 1, teleport: 9 },
        series: [
          { at: "2026-10-01", check: 30, delivered: 2, teleport: 3 },
          { at: "2026-10-02", failed: 1, check: -4 },
          { check: 10 },
          "x",
        ],
      },
      asked,
    );
    expect(activity.totals).toEqual({
      check: 40,
      downloading: 0,
      delivered: 2,
      failed: 1,
      cancelled: 0,
      lifecycle: 0,
      other: 0,
    });
    expect(activity.series).toEqual([
      { at: "2026-10-01", check: 30, delivered: 2 },
      { at: "2026-10-02", failed: 1 },
    ]);
  });

  it("falls back to the asked-for window on an empty body", () => {
    expect(normalizeActivity(null, asked)).toMatchObject({
      ...asked,
      series: [],
      totals: { check: 0, delivered: 0 },
    });
  });
});

describe("toCategory", () => {
  it("reads unknown categories as other", () => {
    expect(toCategory("delivered")).toBe("delivered");
    expect(toCategory("teleported")).toBe("other");
    expect(toCategory(undefined)).toBe("other");
  });
});
