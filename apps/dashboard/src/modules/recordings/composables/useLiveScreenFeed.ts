import type { SafeArea } from "@capuchoo/core";
import { computed, ref, watch, type Ref } from "vue";
import { rewriteReplayEvent, type AssetMap } from "../lib/asset-rewrite";
import { keepReplayEvent } from "../lib/replay-filter";
import type { Lanes } from "../types/recordings.types";
import { useLiveWatch } from "./useLiveWatch";

type ReplayEvent = Lanes["replay"][number];

/**
 * Feeds the player a live device's screen from its socket, ahead of the segments. From the socket's
 * first full snapshot on, its events are the screen; a segment's screen events from that moment are
 * the same ones again and are dropped, while the console, network and database still come from the
 * segments. If the socket drops, the segments take the screen back from where it stopped.
 */
export function useLiveScreenFeed(input: {
  deviceUuid: Ref<string | null>;
  live: Ref<boolean>;
  assets: Ref<AssetMap>;
  assetsReady: Ref<boolean>;
  safeArea: Ref<SafeArea | null>;
  push: (events: ReplayEvent[]) => void;
}) {
  const documents = new Set<number>();
  /** When the socket's screen begins, wall clock; segments yield the screen from here. */
  const since = ref<number | null>(null);
  /** The newest moment the socket has shown, which the timeline must reach. */
  const edge = ref<number | null>(null);
  let held: ReplayEvent[] = [];

  const watcher = useLiveWatch({
    deviceUuid: input.deviceUuid,
    enabled: input.live,
    onEvents: (raw) => accept(raw as ReplayEvent[]),
  });
  const insets = computed(() => watcher.safeArea.value ?? input.safeArea.value);

  function accept(events: ReplayEvent[]) {
    const kept: ReplayEvent[] = [];
    for (const event of events) {
      if (typeof event?.type !== "number" || typeof event.timestamp !== "number") continue;
      if (!keepReplayEvent(event, documents)) continue;
      kept.push(event);
    }
    if (kept.length === 0) return;
    if (!input.assetsReady.value) {
      held.push(...kept);
      return;
    }
    deliver(kept);
  }

  function deliver(events: ReplayEvent[]) {
    for (const event of events) rewriteReplayEvent(event, input.assets.value, insets.value);
    if (since.value === null) {
      const start = events.findIndex((event) => event.type === 2);
      if (start < 0) return;
      events = events.slice(start);
      since.value = events[0]!.timestamp;
    }
    const last = events[events.length - 1]!.timestamp;
    if (edge.value === null || last > edge.value) edge.value = last;
    input.push(events);
  }

  watch(input.assetsReady, (ready) => {
    if (!ready || held.length === 0) return;
    const events = held;
    held = [];
    deliver(events);
  });

  return {
    state: watcher.state,
    edge,
    /**
     * A segment's screen events, minus those the socket shows: everything from its start while it
     * streams, and the stretch it already showed once it has stopped.
     */
    fromSegment(events: ReplayEvent[]): ReplayEvent[] {
      const from = since.value;
      if (from === null) return events;
      const to =
        watcher.state.value === "streaming" ? Number.POSITIVE_INFINITY : (edge.value ?? from);
      return events.filter((event) => event.timestamp < from || event.timestamp > to);
    },
  };
}
