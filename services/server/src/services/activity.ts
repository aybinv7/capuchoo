import type { Db } from "../db/database";
import { activitySeries, type ActivityScope } from "../repositories/device-events";
import type { ActivityQuery } from "./event-range";

/** Every category `classifyUpdateEvent` produces. */
export const EVENT_CATEGORIES: ReadonlySet<string> = new Set([
  "check",
  "downloading",
  "delivered",
  "failed",
  "cancelled",
  "lifecycle",
  "other",
]);

/** Events of a device or a channel, totalled per category and per local hour or day. */
export async function activityOf(db: Db, scope: ActivityScope, query: ActivityQuery) {
  const rows = await activitySeries(db, { ...scope, ...query });
  const totals: Record<string, number> = Object.fromEntries(
    [...EVENT_CATEGORIES].map((category) => [category, 0]),
  );
  const buckets = new Map<string, Record<string, number | string>>();
  for (const row of rows) {
    const category = row.category && EVENT_CATEGORIES.has(row.category) ? row.category : "other";
    const count = Number(row.count);
    totals[category] = (totals[category] ?? 0) + count;
    const bucket = buckets.get(row.at) ?? { at: row.at };
    bucket[category] = Number(bucket[category] ?? 0) + count;
    buckets.set(row.at, bucket);
  }
  return {
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    bucket: query.bucket,
    tz: query.tz,
    totals,
    series: [...buckets.values()],
  };
}
