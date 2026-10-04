export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return Number.NaN;
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

export const median = (values: readonly number[]) =>
  quantile(
    [...values].sort((a, b) => a - b),
    0.5,
  );

export interface Spread {
  n: number;
  median: number;
  p25: number;
  p75: number;
}

export function spread(values: readonly number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface Difference {
  /** Median of `arm` minus median of the baseline, in the metric's unit. */
  delta: number;
  /** The same as a percentage of the baseline's median. */
  percent: number;
  /** 95% bootstrap interval of `delta`. */
  low: number;
  high: number;
  /** The interval excludes zero: the difference is larger than the run-to-run noise. */
  clear: boolean;
}

/**
 * Bootstrap of the difference of medians: resample both groups with replacement, keep the middle
 * 95% of the differences. Makes no assumption about the shape of the data, which with a handful of
 * runs per arm is the honest choice. Seeded, so a report is reproducible.
 */
export function compare(
  baseline: readonly number[],
  arm: readonly number[],
  resamples = 4000,
  seed = 7,
): Difference | null {
  if (baseline.length < 2 || arm.length < 2) return null;
  const next = random(seed);
  const draw = (values: readonly number[]) =>
    median(
      Array.from({ length: values.length }, () => values[Math.floor(next() * values.length)]!),
    );
  const deltas = Array.from({ length: resamples }, () => draw(arm) - draw(baseline)).sort(
    (a, b) => a - b,
  );
  const base = median(baseline);
  const delta = median(arm) - base;
  const low = quantile(deltas, 0.025);
  const high = quantile(deltas, 0.975);
  return {
    delta,
    percent: base === 0 ? Number.NaN : (delta / base) * 100,
    low,
    high,
    clear: low > 0 || high < 0,
  };
}

/** Least-squares slope of y over x, for memory growth per minute in a soak. */
export function slope(points: ReadonlyArray<readonly [number, number]>): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const [x, y] of points) {
    numerator += (x - meanX) * (y - meanY);
    denominator += (x - meanX) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}
