import type { Activity, ActivityCategory, ActivityRow, ActivityWindow } from "../types";
import { ACTIVITY_CATEGORIES } from "./categories";

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

function countsOf(value: unknown): Partial<Record<ActivityCategory, number>> {
  const counts: Partial<Record<ActivityCategory, number>> = {};
  if (!isRow(value)) return counts;
  for (const category of ACTIVITY_CATEGORIES) {
    const raw = value[category];
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) counts[category] = raw;
  }
  return counts;
}

/**
 * An activity answer, total over a partial body: unknown categories and unreadable buckets are
 * dropped, a missing total is zero. The asked-for window stands in for what is absent.
 */
export function normalizeActivity(value: unknown, asked: ActivityWindow): Activity {
  const body = isRow(value) ? value : {};
  const totals = countsOf(body.totals);
  const series: ActivityRow[] = Array.isArray(body.series)
    ? body.series.flatMap((row) => {
        const at = isRow(row) ? text(row.at) : null;
        return at ? [{ at, ...countsOf(row) }] : [];
      })
    : [];
  const bucket = body.bucket === "hour" || body.bucket === "day" ? body.bucket : asked.bucket;
  return {
    from: text(body.from) ?? asked.from,
    to: text(body.to) ?? asked.to,
    bucket,
    tz: text(body.tz) ?? asked.tz,
    totals: Object.fromEntries(
      ACTIVITY_CATEGORIES.map((category) => [category, totals[category] ?? 0]),
    ) as Record<ActivityCategory, number>,
    series,
  };
}
