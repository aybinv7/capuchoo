import { expect, test } from "vite-plus/test";
import {
  MATERIAL_SHAPES,
  materialShapeMask,
  materialShapePath,
} from "../src/shared/utils/shapes/materialShapes.js";

/** Points along the outline itself - sampled on every curve, since control points may overshoot. */
function outline(path: string): Array<[number, number]> {
  const numbers = (text: string) => text.trim().split(/\s+/).map(Number);
  const start = numbers(/^M([^C]+)/.exec(path)![1]!);
  let from: [number, number] = [start[0]!, start[1]!];
  const points: Array<[number, number]> = [from];
  for (const match of path.matchAll(/C([^CZ]+)/g)) {
    const [x1, y1, x2, y2, x, y] = numbers(match[1]!) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let step = 1; step <= 20; step++) {
      const s = step / 20;
      const u = 1 - s;
      points.push([
        u * u * u * from[0] + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x,
        u * u * u * from[1] + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y,
      ]);
    }
    from = [x, y];
  }
  return points;
}

test("every shape is a closed, finite path filling the 100 x 100 box", () => {
  for (const name of MATERIAL_SHAPES) {
    const path = materialShapePath(name);
    expect(path, name).toMatch(/^M[\d.-]+ [\d.-]+(C[\d.\s-]+)+Z$/);

    const points = outline(path);
    expect(points.flat().every(Number.isFinite), name).toBe(true);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    expect(Math.min(...xs, ...ys), name).toBeGreaterThanOrEqual(-0.5);
    expect(Math.max(...xs, ...ys), name).toBeLessThanOrEqual(100.5);
    expect(
      Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
      name,
    ).toBeGreaterThan(99);
  }
});

test("a star keeps one rounded corner per vertex", () => {
  const curves = (name: (typeof MATERIAL_SHAPES)[number]) =>
    (materialShapePath(name).match(/C/g) ?? []).length;
  // Unsmoothed, a corner is one arc; its flanks and the sides between are zero-length and dropped.
  expect(curves("cookie12")).toBe(24);
  expect(curves("cookie9")).toBe(18);
});

test("a mask is a data URI, built once per shape", () => {
  const mask = materialShapeMask("pentagon");
  expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
  expect(materialShapeMask("pentagon")).toBe(mask);
  expect(decodeURIComponent(mask)).toContain(materialShapePath("pentagon"));
});
