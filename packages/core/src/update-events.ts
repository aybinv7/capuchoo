/**
 * What the events in `update_logs` mean.
 *
 * Two producers write to that table and they do not share a vocabulary. The
 * Capgo plugin posts its own names through `/api/stats` - `get`, `set`,
 * `download_complete`, `app_moved_to_foreground`, `*_fail` - while our native
 * updater posts `UPDATE_EVENTS` through `/api/native-updates/log`. Anything
 * reading the table has to understand both, and the dashboard understood
 * neither: it counted downloads as
 *
 *   .in("action", ["downloaded", "install"])
 *
 * and "downloaded" is a name nothing has ever produced. A live table of 34
 * events held `get` (29), `app_moved_to_foreground` (4) and
 * `app_moved_to_background` (1), so the Downloads card and the downloads chart
 * were structurally incapable of showing anything but zero - which is exactly
 * what they showed, and read as "no one is updating" rather than "this is not
 * plugged in".
 *
 * Classifying rather than listing, because the vocabulary grows: the plugin
 * emits progress events like `download_20`, and a new one must not silently
 * fall out of the totals.
 */

export type UpdateEventCategory =
  /** An artefact reached a device and was applied. */
  | "delivered"
  /** An artefact was being fetched. Progress, not completion. */
  | "downloading"
  /** Something went wrong: a download, a checksum, an install, a rollback. */
  | "failed"
  /** The device asked whether an update exists. By far the most common event. */
  | "check"
  /** Foreground, background - useful for activity, not for update health. */
  | "lifecycle"
  /** The user declined, or the app withdrew an offer. */
  | "cancelled"
  /** Recorded, but not understood here. Counted, never silently dropped. */
  | "other";

const DELIVERED = new Set([
  // The plugin's word for "this bundle is now the active one", which is the
  // moment an OTA update actually happens.
  "set",
  "install",
  "download_complete",
  "update_available",
]);

const CHECKS = new Set(["get", "check", "app_moved_to_foreground_check"]);

const CANCELLED = new Set(["cancel", "cancelled", "skip", "postpone"]);

const LIFECYCLE = new Set(["app_moved_to_foreground", "app_moved_to_background", "uninstall"]);

/**
 * `download` on its own is the start of a transfer, and `download_20` is a
 * progress tick. Neither is a delivery, and counting them as one inflates every
 * total by roughly the number of progress notifications the plugin happens to
 * emit.
 */
const DOWNLOADING = /^download(_\d+)?$/;

/** Anything that failed, whatever it was called. */
const FAILED = /(fail|error|denied|rollback)/i;

export function classifyUpdateEvent(action: string | null | undefined): UpdateEventCategory {
  if (!action) return "other";

  const name = action.trim().toLowerCase();
  if (!name) return "other";

  // Failure first: `download_fail` and `set_fail` share a prefix with the
  // success cases, and reading them as deliveries would make a broken rollout
  // look like a perfect one.
  if (FAILED.test(name)) return "failed";
  if (DELIVERED.has(name)) return "delivered";
  if (DOWNLOADING.test(name)) return "downloading";
  if (CHECKS.has(name)) return "check";
  if (CANCELLED.has(name)) return "cancelled";
  if (LIFECYCLE.has(name)) return "lifecycle";

  return "other";
}

export interface EventSummary {
  delivered: number;
  downloading: number;
  failed: number;
  check: number;
  lifecycle: number;
  cancelled: number;
  other: number;
  total: number;
}

const EMPTY: EventSummary = {
  delivered: 0,
  downloading: 0,
  failed: 0,
  check: 0,
  lifecycle: 0,
  cancelled: 0,
  other: 0,
  total: 0,
};

export function summariseEvents(actions: Iterable<string | null | undefined>): EventSummary {
  const summary = { ...EMPTY };

  for (const action of actions) {
    summary[classifyUpdateEvent(action)] += 1;
    summary.total += 1;
  }

  return summary;
}

/**
 * Deliveries as a share of attempts, or null when nothing has been attempted.
 *
 * Null rather than 100%: a channel nobody has updated on yet is not a channel
 * with a perfect record, and the card that used to hard-code "98.5%" said the
 * opposite of nothing-is-known in exactly the situation where nothing was
 * known.
 *
 * Checks and lifecycle events are excluded. Including them would drown the
 * ratio - 29 of 34 events in a real table were `get` - and produce a number
 * that only ever goes up.
 */
export function successRate(summary: EventSummary): number | null {
  const attempts = summary.delivered + summary.failed;
  if (attempts === 0) return null;

  return Math.round((summary.delivered / attempts) * 1000) / 10;
}
