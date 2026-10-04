import { describe, expect, it } from "vite-plus/test";
import { anchorAt, toAppPoint, wheelDelta } from "./assist-coordinates";

const frame = { left: 100, top: 50, width: 196.5, height: 426 };
const viewport = { width: 393, height: 852 };

describe("assist anchors", () => {
  const box = (left: number, top: number, width: number, height: number) => ({
    getBoundingClientRect: () => ({ left, top, width, height }),
  });
  const button = box(100, 200, 50, 20);
  const root = box(0, 0, 393, 852);
  const ids = new Map<unknown, number>([[button, 42]]);
  const doc = (hit: unknown) => ({
    elementFromPoint: () => hit as ReturnType<typeof box> | null,
    documentElement: root,
    body: box(0, 0, 393, 852),
  });
  const idOf = (element: unknown) => ids.get(element) ?? -1;

  it("names the element under the point and where in it the point sits", () => {
    expect(anchorAt(doc(button), idOf, 125, 215)).toEqual({ id: 42, fx: 0.5, fy: 0.75 });
  });

  it("anchors nothing on the page itself, an unknown node or an empty box", () => {
    expect(anchorAt(doc(root), idOf, 10, 10)).toBeNull();
    expect(anchorAt(doc(box(0, 0, 10, 10)), idOf, 5, 5)).toBeNull();
    const flat = box(0, 0, 0, 0);
    ids.set(flat, 9);
    expect(anchorAt(doc(flat), idOf, 0, 0)).toBeNull();
    expect(anchorAt(doc(null), idOf, 0, 0)).toBeNull();
  });
});

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
