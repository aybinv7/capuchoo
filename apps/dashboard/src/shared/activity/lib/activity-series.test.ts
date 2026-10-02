import { describe, expect, it } from "vite-plus/test";
import { activityValues, rateTone, successRate } from "./activity-series";

describe("activity series", () => {
  it("zero-fills every charted category per bucket", () => {
    const values = activityValues(
      ["2026-10-01", "2026-10-02"],
      [{ at: "2026-10-02", delivered: 3, check: 9 }],
    );
    expect(values.delivered).toEqual([0, 3]);
    expect(values.check).toEqual([0, 9]);
    expect(values.failed).toEqual([0, 0]);
  });

  it("rates delivered against everything that finished", () => {
    expect(successRate({ delivered: 9, failed: 1 })).toBe(0.9);
    expect(successRate({ delivered: 0, failed: 0 })).toBeNull();
    expect(rateTone(0.99)).toBe("success");
    expect(rateTone(0.9)).toBe("warning");
    expect(rateTone(0.5)).toBe("danger");
  });
});
