import type { BarSeries } from "@/shared/components/charts/types";
import { fillBuckets } from "@/shared/period/lib/buckets";
import type { ActivityCategory, ActivityRow } from "../types";

export type ChartedCategory = Extract<
  ActivityCategory,
  "delivered" | "failed" | "downloading" | "check"
>;

/** Outcomes at the base of each bar, checks muted on top: they outnumber everything else. */
export const ACTIVITY_SERIES: readonly (BarSeries & { key: ChartedCategory })[] = [
  { key: "delivered", label: "Delivered", color: "var(--success)" },
  { key: "failed", label: "Failed", color: "var(--destructive)" },
  { key: "downloading", label: "Downloads", color: "var(--info)" },
  {
    key: "check",
    label: "Checks",
    color: "color-mix(in oklch, var(--muted-foreground) 35%, transparent)",
  },
];

const CHARTED = ACTIVITY_SERIES.map((entry) => entry.key);

/** One zero-filled count per bucket for each charted category. */
export const activityValues = (
  keys: readonly string[],
  rows: readonly ActivityRow[],
): Record<ChartedCategory, number[]> => fillBuckets(keys, rows, CHARTED);

/** Delivered over delivered plus failed; null when nothing finished. */
export function successRate(
  totals: Pick<Record<ActivityCategory, number>, "delivered" | "failed">,
) {
  const finished = totals.delivered + totals.failed;
  return finished > 0 ? totals.delivered / finished : null;
}

export type RateTone = "success" | "warning" | "danger";

/** How a success rate reads: healthy from 95%, a warning from 80%, a problem below. */
export function rateTone(rate: number): RateTone {
  if (rate >= 0.95) return "success";
  return rate >= 0.8 ? "warning" : "danger";
}
