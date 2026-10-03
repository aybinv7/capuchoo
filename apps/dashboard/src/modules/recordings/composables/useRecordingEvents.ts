import { useQueryClient } from "@tanstack/vue-query";
import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import type { AssetMap } from "../lib/asset-rewrite";
import { rewriteReplayEvent } from "../lib/asset-rewrite";
import { appendToLanes, emptyLanes } from "../lib/lanes";
import { parseSegment } from "../lib/ndjson";
import { keepReplayEvent } from "../lib/replay-filter";
import { fetchSegmentText } from "../services/recordings.service";
import type { Lanes, RecordingSegment } from "../types/recordings.types";

const PARALLEL = 4;
const PUBLISH_MS = 32;

type ReplayEvent = Lanes["replay"][number];

/**
 * Loads a session's segments into lanes, a few at a time and applied strictly in order, so playback
 * can start on the first segment while the rest arrive. New segments of a live session are appended
 * the same way and handed to `onReplay` for the player.
 */
export function useRecordingEvents(input: {
  recordingId: Ref<string>;
  segments: Ref<readonly RecordingSegment[] | undefined>;
  assets: Ref<AssetMap>;
  assetsReady: Ref<boolean>;
  onReplay?: (events: ReplayEvent[]) => void;
}) {
  const client = useQueryClient();
  const lanes = shallowRef<Lanes>(emptyLanes());
  const loaded = ref(0);
  const total = ref(0);
  const error = ref<unknown>(null);
  const applied = new Set<number>();
  const documents = new Set<number>();
  let generation = 0;
  let controller = new AbortController();
  let chain: Promise<void> = Promise.resolve();
  let publishing: ReturnType<typeof setTimeout> | null = null;

  /**
   * Segments land many at a time on open; everything downstream recomputes once per batch. A timer
   * rather than an animation frame, so a replay opened in a background tab still loads.
   */
  function publish() {
    if (publishing !== null) return;
    publishing = setTimeout(() => {
      publishing = null;
      lanes.value = { ...lanes.value };
    }, PUBLISH_MS);
  }

  function cancelPublish() {
    if (publishing !== null) clearTimeout(publishing);
    publishing = null;
  }

  function reset() {
    cancelPublish();
    generation++;
    controller.abort();
    controller = new AbortController();
    applied.clear();
    documents.clear();
    lanes.value = emptyLanes();
    loaded.value = 0;
    total.value = 0;
    error.value = null;
    chain = Promise.resolve();
  }

  function fetchText(id: string, seq: number, signal: AbortSignal) {
    return client.fetchQuery({
      queryKey: queryKeys.recordingSegment(id, seq),
      queryFn: () => fetchSegmentText(id, seq, signal),
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 10 * 60_000,
    });
  }

  function load(segments: readonly RecordingSegment[]) {
    const id = input.recordingId.value;
    const pending = segments.filter((segment) => !applied.has(segment.seq));
    if (pending.length === 0) return;
    for (const segment of pending) applied.add(segment.seq);
    total.value = segments.length;
    const run = generation;
    const signal = controller.signal;

    const texts = new Map<number, Promise<string>>();
    let next = 0;
    const startFetch = () => {
      const segment = pending[next++];
      if (!segment) return;
      texts.set(segment.seq, fetchText(id, segment.seq, signal));
    };
    for (let index = 0; index < PARALLEL; index++) startFetch();

    for (const segment of pending) {
      chain = chain.then(async () => {
        if (run !== generation) return;
        try {
          const text = await texts.get(segment.seq)!;
          startFetch();
          if (run !== generation) return;
          const events = parseSegment(text);
          const replay: ReplayEvent[] = [];
          for (const event of events) {
            if (event.k !== "replay") continue;
            const raw = event.d as ReplayEvent;
            if (!keepReplayEvent(raw, documents)) continue;
            rewriteReplayEvent(raw, input.assets.value);
            replay.push(raw);
          }
          appendToLanes(lanes.value, events, `${segment.seq}`);
          publish();
          loaded.value++;
          if (replay.length > 0) input.onReplay?.(replay);
        } catch (cause) {
          if (signal.aborted) return;
          error.value = cause;
          applied.delete(segment.seq);
          startFetch();
        }
      });
    }
  }

  watch(input.recordingId, reset);
  watch(
    [input.segments, input.assetsReady],
    ([segments, ready]) => {
      if (segments && ready) load(segments);
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    cancelPublish();
    generation++;
    controller.abort();
  });

  return { lanes, loaded, total, error };
}
