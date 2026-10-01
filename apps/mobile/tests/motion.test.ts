import { expect, test } from "vite-plus/test";
import { springAt } from "../src/shared/utils/motion/spring.js";
import {
  createOutlineBuffer,
  determinateFrame,
  indeterminateFrame,
  INDETERMINATE_SHAPES,
  MORPH_INTERVAL_MS,
} from "../src/shared/utils/shapes/loadingIndicator.js";
import { materialShapeCubics } from "../src/shared/utils/shapes/materialShapes.js";
import { reachOf, sampleOutline } from "../src/shared/utils/shapes/morph.js";

test("the morph spring overshoots and settles inside the 650 ms morph interval", () => {
  const samples = Array.from({ length: 66 }, (_, i) => springAt(i / 100, 0.6, 200));
  expect(Math.max(...samples)).toBeGreaterThan(1);
  expect(Math.abs(springAt(MORPH_INTERVAL_MS / 1000, 0.6, 200) - 1)).toBeLessThan(0.01);
});

test("every indicator shape samples to the same point count, starting on the same ray", () => {
  const outlines = INDETERMINATE_SHAPES.map((name) =>
    sampleOutline(materialShapeCubics(name), 144),
  );
  for (const outline of outlines) {
    expect(outline.length).toBe(288);
    expect(outline[0]!).toBeGreaterThan(0.5);
    expect(Math.abs(outline[1]! - 0.5)).toBeLessThan(0.03);
    expect(reachOf(outline)).toBeLessThanOrEqual(0.72);
  }
});

test("the loop starts on the soft burst and turns a quarter per morph", () => {
  const buffer = createOutlineBuffer();
  const start = indeterminateFrame(0, buffer);
  const burst = sampleOutline(materialShapeCubics("softBurst"), 144);
  expect(Array.from(start.outline.slice(0, 8))).toEqual(Array.from(burst.slice(0, 8)));
  expect(start.rotation).toBeCloseTo(90, 5);

  const settled = indeterminateFrame(MORPH_INTERVAL_MS - 1, buffer).rotation;
  const next = indeterminateFrame(MORPH_INTERVAL_MS, buffer).rotation;
  expect(Math.abs(next - settled)).toBeLessThan(2);
});

test("the determinate indicator goes from circle to soft burst, turning back half a turn", () => {
  const buffer = createOutlineBuffer();
  const circle = sampleOutline(materialShapeCubics("circle"), 144);
  const empty = determinateFrame(0, buffer);
  expect(Array.from(empty.outline.slice(0, 8))).toEqual(Array.from(circle.slice(0, 8)));
  expect(determinateFrame(1, buffer).rotation).toBe(-180);
  expect(determinateFrame(3, buffer).rotation).toBe(-180);
});
