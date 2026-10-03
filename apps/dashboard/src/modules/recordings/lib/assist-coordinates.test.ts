import { describe, expect, it } from "vite-plus/test";
import { toAppPoint, wheelDelta } from "./assist-coordinates";

const frame = { left: 100, top: 50, width: 196.5, height: 426 };
const viewport = { width: 393, height: 852 };

describe("assist coordinates", () => {
  it("maps a point on the half-size replay to the app's own pixels", () => {
    expect(toAppPoint(100, 50, frame, viewport, 0.5)).toEqual({ x: 0, y: 0 });
    expect(toAppPoint(150, 150, frame, viewport, 0.5)).toEqual({ x: 100, y: 200 });
  });

  it("ignores a point outside the screen", () => {
    expect(toAppPoint(99, 60, frame, viewport, 0.5)).toBeNull();
    expect(toAppPoint(400, 60, frame, viewport, 0.5)).toBeNull();
  });

  it("scrolls the app as far as the wheel moved on the replay", () => {
    expect(wheelDelta({ deltaX: 0, deltaY: 50, deltaMode: 0 }, viewport, 0.5)).toEqual({
      dx: 0,
      dy: 100,
    });
    expect(wheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }, viewport, 0.5)).toEqual({
      dx: 0,
      dy: 120,
    });
    expect(wheelDelta({ deltaX: 0, deltaY: 1, deltaMode: 2 }, viewport, 0.5)).toEqual({
      dx: 0,
      dy: 852,
    });
  });
});
