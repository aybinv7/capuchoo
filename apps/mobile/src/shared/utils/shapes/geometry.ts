export interface Point {
  x: number;
  y: number;
}

/** A cubic Bézier: anchor, control, control, anchor. */
export type Cubic = readonly [Point, Point, Point, Point];

export const DISTANCE_EPSILON = 1e-4;

export const point = (x: number, y: number): Point => ({ x, y });
export const add = (a: Point, b: Point): Point => point(a.x + b.x, a.y + b.y);
export const sub = (a: Point, b: Point): Point => point(a.x - b.x, a.y - b.y);
export const scale = (a: Point, k: number): Point => point(a.x * k, a.y * k);
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const length = (a: Point): number => Math.hypot(a.x, a.y);
export const rotate90 = (a: Point): Point => point(-a.y, a.x);

export function direction(a: Point): Point {
  const size = length(a);
  if (size <= 0) throw new Error("a direction needs a non-zero vector");
  return scale(a, 1 / size);
}

export function lerp(a: Point, b: Point, fraction: number): Point {
  return point(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction);
}

export function rotateAround(p: Point, degrees: number, center: Point): Point {
  const angle = (degrees * Math.PI) / 180;
  const offset = sub(p, center);
  return add(
    point(
      offset.x * Math.cos(angle) - offset.y * Math.sin(angle),
      offset.x * Math.sin(angle) + offset.y * Math.cos(angle),
    ),
    center,
  );
}

export function straightLine(from: Point, to: Point): Cubic {
  return [from, lerp(from, to, 1 / 3), lerp(from, to, 2 / 3), to];
}

/** `Cubic.circularArc` from androidx graphics-shapes: the arc from p0 to p1 around `center`. */
export function circularArc(center: Point, p0: Point, p1: Point): Cubic {
  const p0d = direction(sub(p0, center));
  const p1d = direction(sub(p1, center));
  const rotatedP0 = rotate90(p0d);
  const rotatedP1 = rotate90(p1d);
  const clockwise = dot(rotatedP0, sub(p1, center)) >= 0;
  const cos = dot(p0d, p1d);
  if (cos > 0.999) return straightLine(p0, p1);
  const k =
    ((((length(sub(p0, center)) * 4) / 3) * (Math.sqrt(2 * (1 - cos)) - Math.sqrt(1 - cos * cos))) /
      (1 - cos)) *
    (clockwise ? 1 : -1);
  return [p0, add(p0, scale(rotatedP0, k)), sub(p1, scale(rotatedP1, k)), p1];
}

function extremaOf(a: number, b: number, c: number, d: number): number[] {
  const qa = -a + 3 * b - 3 * c + d;
  const qb = 2 * (a - 2 * b + c);
  const qc = b - a;
  if (Math.abs(qa) < 1e-9) return Math.abs(qb) < 1e-9 ? [] : [-qc / qb];
  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-qb + root) / (2 * qa), (-qb - root) / (2 * qa)];
}

function at(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** Exact axis-aligned bounds, extrema included - what `normalized()` measures. */
export function boundsOf(cubics: readonly Cubic[]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [p0, c0, c1, p1] of cubics) {
    const xs = [p0.x, p1.x];
    const ys = [p0.y, p1.y];
    for (const t of extremaOf(p0.x, c0.x, c1.x, p1.x)) {
      if (t > 0 && t < 1) xs.push(at(p0.x, c0.x, c1.x, p1.x, t));
    }
    for (const t of extremaOf(p0.y, c0.y, c1.y, p1.y)) {
      if (t > 0 && t < 1) ys.push(at(p0.y, c0.y, c1.y, p1.y, t));
    }
    minX = Math.min(minX, ...xs);
    maxX = Math.max(maxX, ...xs);
    minY = Math.min(minY, ...ys);
    maxY = Math.max(maxY, ...ys);
  }
  return [minX, minY, maxX, maxY];
}
