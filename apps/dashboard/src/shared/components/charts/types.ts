export interface BarSeries {
  key: string;
  label: string;
  /** CSS colour, from the design tokens. */
  color: string;
}

/** What one bar stands for: a local day (`YYYY-MM-DD`) or a local hour (`YYYY-MM-DDTHH`). */
export type BarGranularity = "day" | "hour";

/** A moment drawn over a time chart: a thin rule inside the bucket it fell in. */
export interface ChartMarker {
  key: string;
  /** The bucket it falls in. */
  index: number;
  /** Where inside that bucket, 0 at its start and 1 at its end. */
  offset: number;
  /** CSS colour, from the design tokens. */
  color: string;
  label: string;
}
