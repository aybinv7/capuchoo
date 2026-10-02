import type { DeviceEvent } from "../types/devices.types";

export type TimelineItem<E extends DeviceEvent> =
  | { type: "event"; key: string; event: E }
  | { type: "checks"; key: string; events: E[]; from: string; to: string };

export interface TimelineDay<E extends DeviceEvent> {
  /** `YYYY-MM-DD` in the viewer's (or the given) time zone. */
  day: string;
  items: TimelineItem<E>[];
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
