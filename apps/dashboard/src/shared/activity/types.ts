import type { UpdateEventCategory } from "@capuchoo/core";

export type ActivityCategory = UpdateEventCategory;

export type ActivityBucket = "hour" | "day";

/** One non-empty bucket; `at` is its local start in the zone asked for. */
export type ActivityRow = { at: string } & Partial<Record<ActivityCategory, number>>;

/** `GET …/activity` for a device or a channel: counts per category over a window. */
export interface Activity {
  from: string;
  to: string;
  bucket: ActivityBucket;
  tz: string;
  totals: Record<ActivityCategory, number>;
  series: ActivityRow[];
}

/** What an activity chart is asked for: the window, its bucket size and the viewer's zone. */
export type ActivityWindow = {
  from: string;
  to: string;
  bucket: ActivityBucket;
  tz: string;
};

/** An answer with the bucket keys of the window it was asked for, so a chart never mixes ranges. */
export interface ActivityView extends Activity {
  keys: string[];
}
