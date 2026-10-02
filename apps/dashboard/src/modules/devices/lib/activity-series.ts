import type { BarSeries } from "@/shared/components/charts/types";
import { fillBuckets } from "@/shared/period/lib/buckets";
import type { ActivityRow, DeviceEventCategory } from "../types/devices.types";

export type ChartedCategory = Extract<
  DeviceEventCategory,
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
