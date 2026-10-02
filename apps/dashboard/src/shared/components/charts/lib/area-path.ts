export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AreaGeometry {
  points: { x: number; y: number }[];
  line: string;
  area: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The x of point `index` of `count`; a single point sits in the middle. */
export function pointX(index: number, count: number, box: PlotBox): number {
  if (count <= 1) return box.left + box.width / 2;
  return box.left + (index / (count - 1)) * box.width;
}

/** A line and the area under it, as SVG paths, over values scaled to `max`. */
export function areaGeometry(values: readonly number[], max: number, box: PlotBox): AreaGeometry {
  const ceiling = max > 0 ? max : 1;
  const baseline = box.top + box.height;
  const points = values.map((value, index) => ({
    x: round(pointX(index, values.length, box)),
    y: round(baseline - (Math.min(Math.max(0, value), ceiling) / ceiling) * box.height),
  }));
  if (points.length === 0) return { points, line: "", area: "" };
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join("");
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return { points, line, area: `${line}L${last.x},${baseline}L${first.x},${baseline}Z` };
}

/** The point nearest an x coordinate, or null over an empty chart. */
export function nearestIndex(x: number, count: number, box: PlotBox): number | null {
  if (count <= 0) return null;
  if (count === 1 || box.width <= 0) return 0;
  const share = (x - box.left) / box.width;
  return Math.min(count - 1, Math.max(0, Math.round(share * (count - 1))));
}
