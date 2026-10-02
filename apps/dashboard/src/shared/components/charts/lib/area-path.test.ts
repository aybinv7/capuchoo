import { describe, expect, it } from "vite-plus/test";
import { areaGeometry, nearestIndex, pointX } from "./area-path";

const box = { left: 10, top: 0, width: 100, height: 50 };

describe("area geometry", () => {
  it("spreads points across the plot and scales them to the ceiling", () => {
    const geometry = areaGeometry([0, 5, 10], 10, box);
    expect(geometry.points).toEqual([
      { x: 10, y: 50 },
      { x: 60, y: 25 },
      { x: 110, y: 0 },
    ]);
    expect(geometry.line).toBe("M10,50L60,25L110,0");
    expect(geometry.area).toBe("M10,50L60,25L110,0L110,50L10,50Z");
  });

  it("centres a single point and survives an empty or zero series", () => {
    expect(pointX(0, 1, box)).toBe(60);
    expect(areaGeometry([], 10, box)).toEqual({ points: [], line: "", area: "" });
    expect(areaGeometry([3], 0, box).points[0]?.y).toBe(0);
    expect(areaGeometry([-4], 10, box).points[0]?.y).toBe(50);
  });

  it("finds the nearest point to a pointer", () => {
    expect(nearestIndex(10, 3, box)).toBe(0);
    expect(nearestIndex(70, 3, box)).toBe(1);
    expect(nearestIndex(500, 3, box)).toBe(2);
    expect(nearestIndex(50, 0, box)).toBeNull();
  });
});
