import type { DeviceEvent, EventPage } from "../types/devices.types";

/**
 * Where a timeline stands once the viewer has loaded older events. `anchor` is the cursor the
 * history starts from, frozen when "Load older" is first pressed; `pinned` holds every head event
 * seen since, so the head can be refreshed alone without opening a hole above the history.
 */
export interface FeedState<E extends DeviceEvent> {
  anchor: string | null;
  pinned: E[];
}

export const EMPTY_FEED: FeedState<never> = Object.freeze({ anchor: null, pinned: [] });

/** Newest first; the id breaks ties between events recorded in the same instant. */
export function compareEvents(a: DeviceEvent, b: DeviceEvent): number {
  const delta = Date.parse(b.created_at) - Date.parse(a.created_at);
  if (delta) return delta;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** One newest-first list from several pages; the first copy of an id wins, so pass freshest first. */
export function mergeEvents<E extends DeviceEvent>(...lists: readonly (readonly E[])[]): E[] {
  const seen = new Set<string>();
  const merged: E[] = [];
  for (const list of lists)
    for (const event of list) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      merged.push(event);
    }
  return merged.sort(compareEvents);
}

/** Freezes the history at the head's cursor; a head without one has nothing older to load. */
export function startHistory<E extends DeviceEvent>(
  state: FeedState<E>,
  head: EventPage<E>,
): FeedState<E> {
  if (state.anchor || !head.next) return state;
  return { anchor: head.next, pinned: [...head.events] };
}

/**
 * Folds a refreshed head into the state. While no history is loaded there is nothing to keep.
 * When the new head shares no event with what is pinned and is itself full, more events arrived
 * than one page holds and the gap cannot be filled from either side: the history is dropped and
 * the timeline starts again from the head.
 */
export function reconcileHead<E extends DeviceEvent>(
  state: FeedState<E>,
  head: EventPage<E>,
): FeedState<E> {
  if (!state.anchor) return state;
  const pinned = new Set(state.pinned.map((event) => event.id));
  const touches =
    head.next === null ||
    head.events.length === 0 ||
    head.events.some((event) => pinned.has(event.id));
  if (!touches) return EMPTY_FEED;
  return { anchor: state.anchor, pinned: mergeEvents(head.events, state.pinned) };
}
