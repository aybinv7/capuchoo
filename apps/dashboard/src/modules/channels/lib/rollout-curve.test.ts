import { describe, expect, it } from "vite-plus/test";
import { CURVE_DAYS, fillCurve } from "./rollout-curve";

const today = new Date(2026, 9, 2, 15, 30);
const deliveredAt = new Date(2026, 8, 28, 9, 0).toISOString();

describe("fillCurve", () => {
  it("fills every day from the delivery to today, carrying the last count forward", () => {
    expect(
      fillCurve(
        [
          { day: "2026-09-28", devices: 4 },
          { day: "2026-09-30", devices: 15 },
        ],
        deliveredAt,
        today,
      ),
    ).toEqual([
      { key: "2026-09-28", value: 4 },
      { key: "2026-09-29", value: 4 },
      { key: "2026-09-30", value: 15 },
      { key: "2026-10-01", value: 15 },
      { key: "2026-10-02", value: 15 },
    ]);
  });

  it("starts at zero on a delivery day with no device yet, and never goes down", () => {
    const filled = fillCurve(
      [
        { day: "2026-09-30", devices: 9 },
        { day: "2026-10-01", devices: 7 },
      ],
      deliveredAt,
      today,
    );
    expect(filled.map((point) => point.value)).toEqual([0, 0, 9, 9, 9]);
  });

  it("caps an old delivery at the kept days, starting from what came before", () => {
    const old = new Date(2026, 4, 1).toISOString();
    const filled = fillCurve([{ day: "2026-05-02", devices: 6 }], old, today);
    expect(filled).toHaveLength(CURVE_DAYS);
    expect(filled[0]?.value).toBe(6);
    expect(filled[filled.length - 1]?.key).toBe("2026-10-02");
  });

  it("falls back to the first point without a delivery time, and to nothing without either", () => {
    expect(fillCurve([{ day: "2026-10-01", devices: 2 }], null, today)).toEqual([
      { key: "2026-10-01", value: 2 },
      { key: "2026-10-02", value: 2 },
    ]);
    expect(fillCurve([], null, today)).toEqual([]);
    expect(fillCurve([], "not a date", today)).toEqual([]);
  });

  it("draws a delivery made today as one point", () => {
    expect(fillCurve([], new Date(2026, 9, 2, 8).toISOString(), today)).toEqual([
      { key: "2026-10-02", value: 0 },
    ]);
  });
});
