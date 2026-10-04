/**
 * Circuit-style routing for the release canvas: every link runs in straight horizontal and
 * vertical segments through the empty space between cards, never on top of another link.
 *
 * - A link between neighbouring lanes turns once in the gap between them.
 * - A link that skips lanes climbs to its own horizontal track in a band above the cards, runs
 *   across, and drops into the gap in front of its target.
 * - Each vertical owns a track in its gap and each card side spreads its links into ports, so two
 *   links meet only where they cross, at a right angle.
 */

export const WIRE = {
  /** Distance from a card's edge to the first vertical track in the gap. */
  inset: 14,
  trackGap: 7,
  /** Distance between two links landing on the same side of a card. */
  portGap: 10,
  /** First horizontal track of the band above the cards, under the lane labels. */
  busTop: 34,
  busGap: 9,
  radius: 4,
} as const;

/** Tracks that fit in one half of the gap between columns; beyond this they wrap. */
const MAX_TRACKS = 8;

export interface WireData {
  /** Track of the vertical that leaves the source, counted from the source's edge. */
  exitTrack: number;
  /** Track of the vertical that reaches the target, counted from the target's edge. */
  entryTrack: number;
  /** The horizontal track above the cards, or null for a link between neighbouring lanes. */
  busY: number | null;
  /** Offsets from the middle of each card side, so links land side by side. */
  sourcePort: number;
  targetPort: number;
}

export interface WireLink {
  id: string;
  source: string;
  target: string;
}

export interface WirePlace {
  lane: number;
  y: number;
}

const spread = (index: number, count: number) => (index - (count - 1) / 2) * WIRE.portGap;

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}

/**
 * Assigns every link its ports, tracks and band height. Deterministic: links are ordered by where
 * their cards sit, then by id, so the same graph always wires the same way.
 */
export function assignWires(
  links: readonly WireLink[],
  placeOf: (nodeId: string) => WirePlace | undefined,
): { wires: Map<string, WireData>; busCount: number } {
  const routed = links.flatMap((link) => {
    const source = placeOf(link.source);
    const target = placeOf(link.target);
    return source && target ? [{ link, source, target }] : [];
  });
  type Routed = (typeof routed)[number];
  const byId = (a: Routed, b: Routed) => a.link.id.localeCompare(b.link.id);

  const sourcePort = new Map<string, number>();
  for (const group of groupBy(routed, (entry) => entry.link.source).values()) {
    group.sort((a, b) => a.target.y - b.target.y || byId(a, b));
    group.forEach((entry, index) => sourcePort.set(entry.link.id, spread(index, group.length)));
  }
  const targetPort = new Map<string, number>();
  for (const group of groupBy(routed, (entry) => entry.link.target).values()) {
    group.sort((a, b) => a.source.y - b.source.y || byId(a, b));
    group.forEach((entry, index) => targetPort.set(entry.link.id, spread(index, group.length)));
  }

  const isDirect = (entry: Routed) => entry.target.lane - entry.source.lane === 1;
  const spanning = routed
    .filter((entry) => !isDirect(entry))
    .sort(
      (a, b) =>
        b.target.lane - b.source.lane - (a.target.lane - a.source.lane) ||
        a.source.lane - b.source.lane ||
        a.source.y - b.source.y ||
        byId(a, b),
    );
  const busY = new Map(
    spanning.map((entry, level) => [entry.link.id, WIRE.busTop + level * WIRE.busGap]),
  );

  const exitTrack = new Map<string, number>();
  for (const group of groupBy(routed, (entry) => String(entry.source.lane)).values()) {
    group.sort(
      (a, b) =>
        a.source.y +
          (sourcePort.get(a.link.id) ?? 0) -
          (b.source.y + (sourcePort.get(b.link.id) ?? 0)) || byId(a, b),
    );
    group.forEach((entry, index) => exitTrack.set(entry.link.id, index % MAX_TRACKS));
  }
  const entryTrack = new Map<string, number>();
  for (const group of groupBy(spanning, (entry) => String(entry.target.lane)).values()) {
    group.sort(
      (a, b) =>
        a.target.y +
          (targetPort.get(a.link.id) ?? 0) -
          (b.target.y + (targetPort.get(b.link.id) ?? 0)) || byId(a, b),
    );
    group.forEach((entry, index) => entryTrack.set(entry.link.id, index % MAX_TRACKS));
  }

  const wires = new Map<string, WireData>();
  for (const { link } of routed) {
    wires.set(link.id, {
      exitTrack: exitTrack.get(link.id) ?? 0,
      entryTrack: entryTrack.get(link.id) ?? 0,
      busY: busY.get(link.id) ?? null,
      sourcePort: sourcePort.get(link.id) ?? 0,
      targetPort: targetPort.get(link.id) ?? 0,
    });
  }
  return { wires, busCount: spanning.length };
}

export interface WireGeometry {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export type Point = readonly [number, number];

function corners(points: readonly Point[]): Point[] {
  const kept: Point[] = [];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    const before = kept[kept.length - 2];
    if (
      before &&
      last &&
      ((before[0] === last[0] && last[0] === point[0]) ||
        (before[1] === last[1] && last[1] === point[1]))
    ) {
      kept[kept.length - 1] = point;
      continue;
    }
    kept.push(point);
  }
  return kept;
}

const distance = (a: Point, b: Point) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const toward = (from: Point, to: Point, by: number): Point => {
  const length = distance(from, to) || 1;
  return [from[0] + ((to[0] - from[0]) / length) * by, from[1] + ((to[1] - from[1]) / length) * by];
};
const fmt = (point: Point) => `${Math.round(point[0] * 10) / 10},${Math.round(point[1] * 10) / 10}`;

/** The corners of one link, from the source's side to the target's, without repeated points. */
export function wireRoute(geometry: WireGeometry, wire: WireData): Point[] {
  const start: Point = [geometry.sourceX, geometry.sourceY + wire.sourcePort];
  const end: Point = [geometry.targetX, geometry.targetY + wire.targetPort];
  const exitX = start[0] + WIRE.inset + wire.exitTrack * WIRE.trackGap;
  if (wire.busY === null) {
    if (Math.abs(end[1] - start[1]) < WIRE.radius * 2) return [start, [end[0], start[1]]];
    return corners([start, [exitX, start[1]], [exitX, end[1]], end]);
  }
  const entryX = end[0] - WIRE.inset - wire.entryTrack * WIRE.trackGap;
  return corners([
    start,
    [exitX, start[1]],
    [exitX, wire.busY],
    [entryX, wire.busY],
    [entryX, end[1]],
    end,
  ]);
}

/** The SVG path of one link, with its label at the middle of its longest segment. */
export function wirePath(
  geometry: WireGeometry,
  wire: WireData,
): { path: string; labelX: number; labelY: number } {
  const points = wireRoute(geometry, wire);
  const start = points[0]!;
  let path = `M ${fmt(points[0]!)}`;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[index + 1];
    if (!next) {
      path += ` L ${fmt(point)}`;
      break;
    }
    const previous = points[index - 1]!;
    const radius = Math.min(WIRE.radius, distance(previous, point) / 2, distance(point, next) / 2);
    path += ` L ${fmt(toward(point, previous, radius))} Q ${fmt(point)} ${fmt(toward(point, next, radius))}`;
  }

  let longest = 0;
  let label: Point = start;
  for (let index = 1; index < points.length; index += 1) {
    const length = distance(points[index - 1]!, points[index]!);
    if (length > longest) {
      longest = length;
      label = toward(points[index - 1]!, points[index]!, length / 2);
    }
  }
  return { path, labelX: label[0], labelY: label[1] };
}
