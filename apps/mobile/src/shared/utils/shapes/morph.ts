import type { Cubic } from "./geometry";

/** Points around an outline, x and y interleaved, in the unit square. */
export type Outline = Float32Array;

const CENTER = 0.5;
const SAMPLES_PER_CUBIC = 24;

function bezier(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function dense(cubics: readonly Cubic[]): number[] {
  const points: number[] = [];
  for (const [p0, c0, c1, p1] of cubics) {
    for (let step = 0; step < SAMPLES_PER_CUBIC; step++) {
      const t = step / SAMPLES_PER_CUBIC;
      points.push(bezier(p0.x, c0.x, c1.x, p1.x, t), bezier(p0.y, c0.y, c1.y, p1.y, t));
    }
  }
  return points;
}

function signedArea(points: readonly number[]): number {
  let area = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i * 2]! * points[j * 2 + 1]! - points[j * 2]! * points[i * 2 + 1]!;
  }
  return area / 2;
}

/**
 * The outline as `count` points spaced evenly along its length, clockwise, starting where it
 * crosses the ray from the centre at angle 0 - the `startAngle = 0` Material's morph draws from.
 * Two outlines sampled this way can be interpolated point by point: point i of each sits at the
 * same fraction of the way round, which is what makes one shape flow into the next instead of
 * twisting through it.
 */
export function sampleOutline(cubics: readonly Cubic[], count: number): Outline {
  const raw = dense(cubics);
  const n = raw.length / 2;
  const clockwise = signedArea(raw) > 0;

  const ordered: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = clockwise ? k : n - 1 - k;
    ordered.push(raw[i * 2]!, raw[i * 2 + 1]!);
  }

  let start = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const x = ordered[i * 2]! - CENTER;
    const y = ordered[i * 2 + 1]! - CENTER;
    if (x <= 0) continue;
    const angle = Math.abs(Math.atan2(y, x));
    if (angle < best) {
      best = angle;
      start = i;
    }
  }

  const lengths = new Float64Array(n + 1);
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const j = (start + k + 1) % n;
    lengths[k + 1] =
      lengths[k]! +
      Math.hypot(ordered[j * 2]! - ordered[i * 2]!, ordered[j * 2 + 1]! - ordered[i * 2 + 1]!);
  }
  const total = lengths[n]!;

  const outline = new Float32Array(count * 2);
  let segment = 0;
  for (let s = 0; s < count; s++) {
    const target = (total * s) / count;
    while (segment < n - 1 && lengths[segment + 1]! < target) segment++;
    const span = lengths[segment + 1]! - lengths[segment]!;
    const t = span > 0 ? (target - lengths[segment]!) / span : 0;
    const i = (start + segment) % n;
    const j = (start + segment + 1) % n;
    outline[s * 2] = ordered[i * 2]! + (ordered[j * 2]! - ordered[i * 2]!) * t;
    outline[s * 2 + 1] = ordered[i * 2 + 1]! + (ordered[j * 2 + 1]! - ordered[i * 2 + 1]!) * t;
  }
  return outline;
}

/** Point-by-point interpolation into `into`, which is returned - no allocation per frame. */
export function morphOutline(from: Outline, to: Outline, progress: number, into: Outline): Outline {
  for (let i = 0; i < into.length; i++) into[i] = from[i]! + (to[i]! - from[i]!) * progress;
  return into;
}

/**
 * How far any point reaches from the centre. A shape rotating in a square box needs this, not its
 * bounds, to never be clipped - the role of `calculateMaxBounds` in Material's indicator.
 */
export function reachOf(outline: Outline): number {
  let reach = 0;
  for (let i = 0; i < outline.length; i += 2) {
    reach = Math.max(reach, Math.hypot(outline[i]! - CENTER, outline[i + 1]! - CENTER));
  }
  return reach;
}

/** An SVG path over a 100 x 100 box, centred, scaled by `scale` about the centre. */
export function outlinePath(outline: Outline, scale = 1): string {
  const f = (value: number) => ((value - CENTER) * scale * 100 + 50).toFixed(1);
  let d = `M${f(outline[0]!)} ${f(outline[1]!)}`;
  for (let i = 2; i < outline.length; i += 2) d += `L${f(outline[i]!)} ${f(outline[i + 1]!)}`;
  return `${d}Z`;
}
