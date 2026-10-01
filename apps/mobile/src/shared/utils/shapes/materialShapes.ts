import { point, type Cubic } from "./geometry";
import {
  circleVertices,
  normalize,
  repeatVertices,
  rotateCubics,
  roundedPolygon,
  scaleCubics,
  starVertices,
  toSvgPath,
  type Vertex,
} from "./roundedPolygon";

/**
 * Material 3 Expressive's shape library, built the way `androidx.compose.material3.MaterialShapes`
 * builds it - same vertices, same per-corner rounding, same normalisation into the unit square - so
 * a cookie here is the cookie Android draws. Numbers are copied from that source, not eyeballed.
 */
const at = (x: number, y: number, radius?: number, smoothing?: number): Vertex => ({
  at: point(x, y),
  rounding: radius === undefined ? undefined : { radius, smoothing },
});

const DEFINITIONS = {
  circle: () => roundedPolygon(circleVertices(10)),
  oval: () => rotateCubics(scaleCubics(roundedPolygon(circleVertices()), 1, 0.64), -45),
  pill: () =>
    roundedPolygon(
      repeatVertices([at(0.961, 0.039, 0.426), at(1.001, 0.428), at(1, 0.609, 1)], 2, true),
    ),
  cookie4: () =>
    roundedPolygon(repeatVertices([at(1.237, 1.236, 0.258), at(0.5, 0.918, 0.233)], 4)),
  cookie9: () => rotateCubics(roundedPolygon(starVertices(9, 0.8, { radius: 0.5 })), -90),
  cookie12: () => rotateCubics(roundedPolygon(starVertices(12, 0.8, { radius: 0.5 })), -90),
  pentagon: () =>
    roundedPolygon(
      repeatVertices(
        [at(0.5, -0.009, 0.172), at(1.03, 0.365, 0.164), at(0.828, 0.97, 0.169)],
        1,
        true,
      ),
    ),
  gem: () =>
    roundedPolygon(
      repeatVertices(
        [
          at(0.499, 1.023, 0.241, 0.778),
          at(-0.005, 0.792, 0.208),
          at(0.073, 0.258, 0.228),
          at(0.433, 0, 0.491),
        ],
        1,
        true,
      ),
    ),
  sunny: () => roundedPolygon(starVertices(8, 0.8, { radius: 0.15 })),
  verySunny: () =>
    roundedPolygon(repeatVertices([at(0.5, 1.08, 0.085), at(0.358, 0.843, 0.085)], 8)),
  clover4: () =>
    roundedPolygon(repeatVertices([at(0.5, 0.074), at(0.725, -0.099, 0.476)], 4, true)),
  clover8: () => roundedPolygon(repeatVertices([at(0.5, 0.036), at(0.758, -0.101, 0.209)], 8)),
  flower: () =>
    roundedPolygon(
      repeatVertices([at(0.37, 0.187), at(0.416, 0.049, 0.381), at(0.479, 0.001, 0.095)], 8, true),
    ),
  softBurst: () =>
    roundedPolygon(repeatVertices([at(0.193, 0.277, 0.053), at(0.176, 0.055, 0.053)], 10)),
  burst: () =>
    roundedPolygon(repeatVertices([at(0.5, -0.006, 0.006), at(0.592, 0.158, 0.006)], 12)),
} satisfies Record<string, () => Cubic[]>;

export type MaterialShapeName = keyof typeof DEFINITIONS;

export const MATERIAL_SHAPES = Object.keys(DEFINITIONS) as MaterialShapeName[];

/** A shape's outline, normalised into the unit square - what the morph samples. */
export function materialShapeCubics(name: MaterialShapeName): Cubic[] {
  return normalize(DEFINITIONS[name]());
}

const paths = new Map<MaterialShapeName, string>();
const masks = new Map<MaterialShapeName, string>();

/** The shape's outline over a 100 x 100 box, computed once per shape. */
export function materialShapePath(name: MaterialShapeName): string {
  let path = paths.get(name);
  if (!path) {
    path = toSvgPath(materialShapeCubics(name));
    paths.set(name, path);
  }
  return path;
}

/** A CSS `mask-image` value: anything inside the element is cut to the shape. */
export function materialShapeMask(name: MaterialShapeName): string {
  let mask = masks.get(name);
  if (!mask) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="black" d="${materialShapePath(name)}"/></svg>`;
    mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    masks.set(name, mask);
  }
  return mask;
}
