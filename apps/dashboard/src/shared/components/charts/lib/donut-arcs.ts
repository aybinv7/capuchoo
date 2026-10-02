export interface DonutSlice {
  key: string;
  value: number;
}

export interface DonutArc {
  key: string;
  /** Visible stroke length along the circle. */
  length: number;
  /** Where the arc starts, as a negative `stroke-dashoffset`. */
  offset: number;
  share: number;
}

/**
 * Arcs for a ring of `circumference`, in slice order from 12 o'clock, separated by `gap` when more
 * than one slice shows. A slice too small to survive the gap keeps a sliver so it stays hoverable.
 */
export function donutArcs(
  slices: readonly DonutSlice[],
  circumference: number,
  gap: number,
  minLength = 1.5,
): DonutArc[] {
  const kept = slices.filter((slice) => slice.value > 0);
  const total = kept.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0 || circumference <= 0) return [];
  const spacing = kept.length > 1 ? gap : 0;
  let start = 0;
  return kept.map((slice) => {
    const share = slice.value / total;
    const span = share * circumference;
    const arc = {
      key: slice.key,
      length: Math.max(minLength, span - spacing),
      offset: -(start + spacing / 2),
      share,
    };
    start += span;
    return arc;
  });
}
