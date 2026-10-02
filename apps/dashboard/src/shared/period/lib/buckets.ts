import { addDays, dayKey, hourKey } from "./local-day";
import type { ResolvedPeriod } from "./period";

export type Bucket = "hour" | "day";

const HOUR_MS = 3_600_000;

/** Hourly bars for a range of two days or less, daily beyond. */
export const bucketFor = (resolved: Pick<ResolvedPeriod, "days">): Bucket =>
  resolved.days <= 2 ? "hour" : "day";

/**
 * Every bucket key of a range, oldest first, in the local zone: `YYYY-MM-DD` per day or
 * `YYYY-MM-DDTHH` per hour. Hours are stepped as instants, so a spring-forward day has 23 keys and
 * the repeated autumn hour is one key, as the server's local bucketing has it.
 */
export function bucketKeys(
  resolved: Pick<ResolvedPeriod, "start" | "end">,
  bucket: Bucket,
): string[] {
  const keys: string[] = [];
  if (bucket === "day") {
    for (let day = resolved.start; day < resolved.end; day = addDays(day, 1))
      keys.push(dayKey(day));
    return keys;
  }
  const end = resolved.end.getTime();
  for (let time = resolved.start.getTime(); time < end; time += HOUR_MS) {
    const key = hourKey(new Date(time));
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

/** One zero-filled count per key for each series; rows outside the keys are ignored. */
export function fillBuckets<S extends string>(
  keys: readonly string[],
  rows: ReadonlyArray<{ at: string } & Partial<Record<S, number>>>,
  series: readonly S[],
): Record<S, number[]> {
  const index = new Map(keys.map((key, position) => [key, position]));
  const filled = Object.fromEntries(
    series.map((name) => [name, Array.from({ length: keys.length }, () => 0)]),
  ) as Record<S, number[]>;
  for (const row of rows) {
    const position = index.get(row.at);
    if (position === undefined) continue;
    for (const name of series) {
      const value = row[name];
      const column = filled[name];
      if (typeof value === "number" && Number.isFinite(value))
        column[position] = (column[position] ?? 0) + value;
    }
  }
  return filled;
}
