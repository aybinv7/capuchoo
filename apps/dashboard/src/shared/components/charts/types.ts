export interface BarSeries {
  key: string;
  label: string;
  /** CSS colour, from the design tokens. */
  color: string;
}

/** What one bar stands for: a local day (`YYYY-MM-DD`) or a local hour (`YYYY-MM-DDTHH`). */
export type BarGranularity = "day" | "hour";
