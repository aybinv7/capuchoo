import { addDays, dayKey, hourKey, parseDayKey } from "@/shared/period/lib/local-day";
import type { BarGranularity, ChartMarker } from "../types";

/** A moment to place: an ISO instant with what to draw for it. */
export interface MarkerInput {
  key: string;
  at: string;
  color: string;
  label: string;
}

const HOUR_MS = 3_600_000;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function offsetIn(date: Date, key: string, granularity: BarGranularity): number {
  if (granularity === "hour")
    return clamp((date.getMinutes() * 60_000 + date.getSeconds() * 1000) / HOUR_MS);
  const start = parseDayKey(key);
  if (!start) return 0.5;
  const length = addDays(start, 1).getTime() - start.getTime();
  return clamp((date.getTime() - start.getTime()) / length);
}

/**
 * Places moments on a chart's local buckets (`YYYY-MM-DD` or `YYYY-MM-DDTHH`), oldest first.
 * Moments outside the buckets, or without a readable time, are left out.
 */
export function placeMarkers(
  inputs: readonly MarkerInput[],
  buckets: readonly string[],
  granularity: BarGranularity,
): ChartMarker[] {
  const index = new Map(buckets.map((bucket, position) => [bucket, position]));
  const placed: (ChartMarker & { time: number })[] = [];
  for (const input of inputs) {
    const time = Date.parse(input.at);
    if (Number.isNaN(time)) continue;
    const date = new Date(time);
    const bucket = granularity === "hour" ? hourKey(date) : dayKey(date);
    const position = index.get(bucket);
    if (position === undefined) continue;
    placed.push({
      key: input.key,
      index: position,
      offset: offsetIn(date, bucket, granularity),
      color: input.color,
      label: input.label,
      time,
    });
  }
  return placed.sort((a, b) => a.time - b.time).map(({ time: _time, ...marker }) => marker);
}

/** The markers that fall in one bucket. */
export const markersAt = (markers: readonly ChartMarker[], index: number): ChartMarker[] =>
  markers.filter((marker) => marker.index === index);
