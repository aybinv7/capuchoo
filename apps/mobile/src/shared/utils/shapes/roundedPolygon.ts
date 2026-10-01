import {
  add,
  boundsOf,
  circularArc,
  DISTANCE_EPSILON,
  direction,
  dot,
  length,
  lerp,
  point,
  rotate90,
  rotateAround,
  scale,
  straightLine,
  sub,
  type Cubic,
  type Point,
} from "./geometry";

export interface CornerRounding {
  radius: number;
  /** 0 is a circular arc; up to 1 blends the arc into the sides with flanking curves. */
  smoothing?: number;
}

export interface Vertex {
  at: Point;
  rounding?: CornerRounding;
}

const UNROUNDED: CornerRounding = { radius: 0 };

/**
 * One corner, as `RoundedCorner` in androidx graphics-shapes computes it: first how much of each
 * side the rounding wants, then - once the neighbours have been asked too - the curves for what it
 * is actually allowed.
 */
class Corner {
  readonly d1: Point;
  readonly d2: Point;
  readonly radius: number;
  readonly smoothing: number;
  readonly expectedRoundCut: number;

  constructor(
    readonly p0: Point,
    readonly p1: Point,
    readonly p2: Point,
    rounding: CornerRounding,
  ) {
    const v01 = sub(p0, p1);
    const v21 = sub(p2, p1);
    const d01 = length(v01);
    const d21 = length(v21);
    if (d01 > 0 && d21 > 0) {
      this.d1 = scale(v01, 1 / d01);
      this.d2 = scale(v21, 1 / d21);
      this.radius = rounding.radius;
      this.smoothing = rounding.smoothing ?? 0;
      const cos = dot(this.d1, this.d2);
      const sin = Math.sqrt(1 - cos * cos);
      this.expectedRoundCut = sin > 1e-3 ? (this.radius * (cos + 1)) / sin : 0;
    } else {
      this.d1 = point(0, 0);
      this.d2 = point(0, 0);
      this.radius = 0;
      this.smoothing = 0;
      this.expectedRoundCut = 0;
    }
  }

  get expectedCut(): number {
    return (1 + this.smoothing) * this.expectedRoundCut;
  }

  private smoothingFor(allowedCut: number): number {
    if (allowedCut > this.expectedCut) return this.smoothing;
    if (allowedCut > this.expectedRoundCut) {
      return (
        (this.smoothing * (allowedCut - this.expectedRoundCut)) /
        (this.expectedCut - this.expectedRoundCut)
      );
    }
    return 0;
  }

  cubics(allowedCut0: number, allowedCut1: number): Cubic[] {
    const allowedCut = Math.min(allowedCut0, allowedCut1);
    if (
      this.expectedRoundCut < DISTANCE_EPSILON ||
      allowedCut < DISTANCE_EPSILON ||
      this.radius < DISTANCE_EPSILON
    ) {
      return [straightLine(this.p1, this.p1)];
    }
    const roundCut = Math.min(allowedCut, this.expectedRoundCut);
    const smoothing0 = this.smoothingFor(allowedCut0);
    const smoothing1 = this.smoothingFor(allowedCut1);
    const radius = (this.radius * roundCut) / this.expectedRoundCut;
    const centerDistance = Math.hypot(radius, roundCut);
    const center = add(
      this.p1,
      scale(direction(scale(add(this.d1, this.d2), 0.5)), centerDistance),
    );
    const hit0 = add(this.p1, scale(this.d1, roundCut));
    const hit2 = add(this.p1, scale(this.d2, roundCut));
    const flanking0 = this.flank(roundCut, smoothing0, this.p0, hit0, hit2, center, radius);
    const flanking2 = reverse(
      this.flank(roundCut, smoothing1, this.p2, hit2, hit0, center, radius),
    );
    return [flanking0, circularArc(center, flanking0[3], flanking2[0]), flanking2];
  }

  private flank(
    roundCut: number,
    smoothing: number,
    sideStart: Point,
    hit: Point,
    otherHit: Point,
    center: Point,
    radius: number,
  ): Cubic {
    const side = direction(sub(sideStart, this.p1));
    const curveStart = add(this.p1, scale(side, roundCut * (1 + smoothing)));
    const onArc = lerp(hit, scale(add(hit, otherHit), 0.5), smoothing);
    const curveEnd = add(center, scale(direction(sub(onArc, center)), radius));
    const tangent = rotate90(sub(curveEnd, center));
    const anchorEnd = intersect(sideStart, side, curveEnd, tangent) ?? hit;
    const anchorStart = scale(add(curveStart, scale(anchorEnd, 2)), 1 / 3);
    return [curveStart, anchorStart, anchorEnd, curveEnd];
  }
}

function reverse([a, b, c, d]: Cubic): Cubic {
  return [d, c, b, a];
}

function intersect(p0: Point, d0: Point, p1: Point, d1: Point): Point | null {
  const rotated = rotate90(d1);
  const den = dot(d0, rotated);
  if (Math.abs(den) < DISTANCE_EPSILON) return null;
  const num = dot(sub(p1, p0), rotated);
  if (Math.abs(den) < DISTANCE_EPSILON * Math.abs(num)) return null;
  return add(p0, scale(d0, num / den));
}

/**
 * `RoundedPolygon(vertices, perVertexRounding)`: each side is shared by two corners, so when both
 * want more than the side has, rounding is honoured before smoothing, in proportion.
 */
export function roundedPolygon(vertices: readonly Vertex[]): Cubic[] {
  const n = vertices.length;
  if (n < 3) throw new Error("a polygon needs at least three vertices");

  const corners = vertices.map(
    (vertex, i) =>
      new Corner(
        vertices[(i + n - 1) % n]!.at,
        vertex.at,
        vertices[(i + 1) % n]!.at,
        vertex.rounding ?? UNROUNDED,
      ),
  );

  const sideRatios = corners.map((corner, i) => {
    const next = corners[(i + 1) % n]!;
    const roundCut = corner.expectedRoundCut + next.expectedRoundCut;
    const cut = corner.expectedCut + next.expectedCut;
    const side = length(sub(vertices[i]!.at, vertices[(i + 1) % n]!.at));
    if (roundCut > side) return [side / roundCut, 0] as const;
    if (cut > side) return [1, (side - roundCut) / (cut - roundCut)] as const;
    return [1, 1] as const;
  });

  const cornerCubics = corners.map((corner, i) => {
    const allowed = [0, 1].map((delta) => {
      const [roundRatio, cutRatio] = sideRatios[(i + n - 1 + delta) % n]!;
      return (
        corner.expectedRoundCut * roundRatio +
        (corner.expectedCut - corner.expectedRoundCut) * cutRatio
      );
    });
    return corner.cubics(allowed[0]!, allowed[1]!);
  });

  const outline: Cubic[] = [];
  cornerCubics.forEach((cubics, i) => {
    outline.push(...cubics);
    const next = cornerCubics[(i + 1) % n]!;
    outline.push(straightLine(cubics.at(-1)![3], next[0]![0]));
  });
  return outline;
}

/** `RoundedPolygon(numVertices, rounding, radius)`: a regular polygon around the origin. */
export function regularVertices(count: number, radius: number, rounding: CornerRounding): Vertex[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((Math.PI * 2) / count) * i;
    return { at: point(Math.cos(angle) * radius, Math.sin(angle) * radius), rounding };
  });
}

/** `RoundedPolygon.circle`: a polygon whose rounded corners meet into a circle of `radius`. */
export function circleVertices(count = 8, radius = 1): Vertex[] {
  return regularVertices(count, radius / Math.cos(Math.PI / count), { radius });
}

export function scaleCubics(cubics: readonly Cubic[], x: number, y: number): Cubic[] {
  return cubics.map((cubic) => cubic.map((p) => point(p.x * x, p.y * y)) as unknown as Cubic);
}

/** `RoundedPolygon.star`: alternating outer (radius 1) and inner vertices around the origin. */
export function starVertices(
  count: number,
  innerRadius: number,
  rounding: CornerRounding,
): Vertex[] {
  return Array.from({ length: count * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? 1 : innerRadius;
    const angle = (Math.PI / count) * i;
    return { at: point(Math.cos(angle) * radius, Math.sin(angle) * radius), rounding };
  });
}

/**
 * `customPolygon` from Material 3's `MaterialShapes`: a few points repeated around a centre, and
 * with `mirroring` reflected within each section, which is how the clover and pentagon are drawn.
 */
export function repeatVertices(
  points: readonly Vertex[],
  reps: number,
  mirroring = false,
  center: Point = point(0.5, 0.5),
): Vertex[] {
  if (!mirroring) {
    return Array.from({ length: points.length * reps }, (_, i) => {
      const source = points[i % points.length]!;
      return {
        at: rotateAround(source.at, (Math.floor(i / points.length) * 360) / reps, center),
        rounding: source.rounding,
      };
    });
  }

  const angles = points.map(
    (p) => (Math.atan2(p.at.y - center.y, p.at.x - center.x) * 180) / Math.PI,
  );
  const distances = points.map((p) => length(sub(p.at, center)));
  const sections = reps * 2;
  const sectionAngle = 360 / sections;
  const result: Vertex[] = [];
  for (let section = 0; section < sections; section++) {
    for (let index = 0; index < points.length; index++) {
      const i = section % 2 === 0 ? index : points.length - 1 - index;
      if (i > 0 || section % 2 === 0) {
        const degrees =
          sectionAngle * section +
          (section % 2 === 0 ? angles[i]! : sectionAngle - angles[i]! + 2 * angles[0]!);
        const angle = (degrees * Math.PI) / 180;
        result.push({
          at: add(scale(point(Math.cos(angle), Math.sin(angle)), distances[i]!), center),
          rounding: points[i]!.rounding,
        });
      }
    }
  }
  return result;
}

export function rotateCubics(cubics: readonly Cubic[], degrees: number): Cubic[] {
  const origin = point(0, 0);
  return cubics.map(
    (cubic) => cubic.map((p) => rotateAround(p, degrees, origin)) as unknown as Cubic,
  );
}

/** `normalized()`: moved and scaled into the unit square, centred along the shorter side. */
export function normalize(cubics: readonly Cubic[]): Cubic[] {
  const [minX, minY, maxX, maxY] = boundsOf(cubics);
  const width = maxX - minX;
  const height = maxY - minY;
  const side = Math.max(width, height);
  const offsetX = (side - width) / 2 - minX;
  const offsetY = (side - height) / 2 - minY;
  return cubics.map(
    (cubic) =>
      cubic.map((p) => point((p.x + offsetX) / side, (p.y + offsetY) / side)) as unknown as Cubic,
  );
}

/** An SVG path over a `size` x `size` box. Zero-length cubics (unrounded corners) are skipped. */
export function toSvgPath(cubics: readonly Cubic[], size = 100): string {
  const f = (value: number) => Number((value * size).toFixed(2));
  const [first] = cubics;
  if (!first) return "";
  const parts = [`M${f(first[0].x)} ${f(first[0].y)}`];
  for (const [p0, c0, c1, p1] of cubics) {
    if (length(sub(p1, p0)) < DISTANCE_EPSILON && length(sub(c0, p0)) < DISTANCE_EPSILON) continue;
    parts.push(`C${f(c0.x)} ${f(c0.y)} ${f(c1.x)} ${f(c1.y)} ${f(p1.x)} ${f(p1.y)}`);
  }
  parts.push("Z");
  return parts.join("");
}
