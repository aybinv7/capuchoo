import type { DeviceEvent } from "../types/devices.types";

export type TimelineItem<E extends DeviceEvent> =
  | { type: "event"; key: string; event: E }
  | { type: "checks"; key: string; events: E[]; from: string; to: string };

export interface TimelineDay<E extends DeviceEvent> {
  /** `YYYY-MM-DD` in the viewer's (or the given) time zone. */
  day: string;
  items: TimelineItem<E>[];
}

/** A function mapping an ISO instant to its calendar day, `YYYY-MM-DD`, in `timeZone`. */
export function dayKeyFormatter(timeZone?: string): (iso: string) => string {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (iso) => {
    const time = Date.parse(iso);
    return Number.isNaN(time) ? "unknown" : format.format(time);
  };
}

function closeRun<E extends DeviceEvent>(run: E[], items: TimelineItem<E>[]) {
  if (run.length === 1) items.push({ type: "event", key: run[0]!.id, event: run[0]! });
  else if (run.length > 1)
    items.push({
      type: "checks",
      key: `checks:${run[run.length - 1]!.id}`,
      events: [...run],
      from: run[run.length - 1]!.created_at,
      to: run[0]!.created_at,
    });
  run.length = 0;
}

/**
 * Events, newest first, grouped by day, with each run of consecutive update checks inside a day
 * folded into one item unless `collapseChecks` is false. A run is keyed by its oldest check, so
 * the key survives new checks arriving on top.
 */
export function groupTimeline<E extends DeviceEvent>(
  events: readonly E[],
  dayOf: (iso: string) => string,
  collapseChecks = true,
): TimelineDay<E>[] {
  const days: TimelineDay<E>[] = [];
  const run: E[] = [];
  let current: TimelineDay<E> | null = null;
  for (const event of events) {
    const day = dayOf(event.created_at);
    if (!current || current.day !== day) {
      if (current) closeRun(run, current.items);
      current = { day, items: [] };
      days.push(current);
    }
    if (collapseChecks && event.category === "check") {
      run.push(event);
      continue;
    }
    closeRun(run, current.items);
    current.items.push({ type: "event", key: event.id, event });
  }
  if (current) closeRun(run, current.items);
  return days;
}

const dayHeading = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayHeadingWithYear = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** `Today`, `Yesterday`, `Mon, Sep 28`, or with the year when it is not the current one. */
export function dayLabel(day: string, today: string, yesterday: string): string {
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Unknown day";
  return day.slice(0, 4) === today.slice(0, 4)
    ? dayHeading.format(date)
    : dayHeadingWithYear.format(date);
}

/** How many devices a run of app-wide events came from; null for one device's own timeline. */
export function deviceCount(events: readonly DeviceEvent[]): number | null {
  const ids = new Set<string>();
  for (const event of events) {
    if (!("device" in event)) return null;
    const device = (event as { device: { id: string } | null }).device;
    if (device) ids.add(device.id);
  }
  return ids.size;
}
