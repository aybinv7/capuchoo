import { addDays, dayKey, parseDayKey, startOfDay } from "@/shared/period/lib/local-day";
import type { CurvePoint } from "../types/channel-insights.types";

/** How far back the server keeps a curve. */
export const CURVE_DAYS = 60;

export interface CurveValue {
  /** A local day, `YYYY-MM-DD`. */
  key: string;
  value: number;
}

function firstDay(curve: readonly CurvePoint[], deliveredAt: string | null): Date | null {
  const time = deliveredAt ? Date.parse(deliveredAt) : Number.NaN;
  if (!Number.isNaN(time)) return startOfDay(new Date(time));
  const first = curve[0];
  return first ? parseDayKey(first.day) : null;
}

/**
 * One cumulative count per local day from the delivery to today, both included: days the server
 * left out carry the day before, and the count never goes down. At most `CURVE_DAYS` days.
 */
export function fillCurve(
  curve: readonly CurvePoint[],
  deliveredAt: string | null,
  today: Date,
): CurveValue[] {
  const last = startOfDay(today);
  const first = firstDay(curve, deliveredAt);
  if (!first) return [];
  const floor = addDays(last, -(CURVE_DAYS - 1));
  const start = first < floor ? floor : first > last ? last : first;
  const startKey = dayKey(start);
  const counts = new Map<string, number>();
  let value = 0;
  for (const point of curve) {
    if (point.day < startKey) value = Math.max(value, point.devices);
    else counts.set(point.day, Math.max(counts.get(point.day) ?? 0, point.devices));
  }
  const filled: CurveValue[] = [];
  for (let day = start; day <= last; day = addDays(day, 1)) {
    const key = dayKey(day);
    value = Math.max(value, counts.get(key) ?? 0);
    filled.push({ key, value });
  }
  return filled;
}
