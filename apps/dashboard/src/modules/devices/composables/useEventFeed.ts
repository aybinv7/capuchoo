import { useInfiniteQuery, useQuery } from "@tanstack/vue-query";
import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import {
  EMPTY_FEED,
  mergeEvents,
  reconcileHead,
  startHistory,
  type FeedState,
} from "../lib/event-feed";
import type { DeviceEvent, EventPage } from "../types/devices.types";

export interface EventFeedOptions<E extends DeviceEvent> {
  /** The head's key; live events invalidate it, so only the newest page is ever refetched. */
  headKey: MaybeRefOrGetter<readonly unknown[]>;
  /** What the older pages are scoped by (the head key without the app prefix is enough). */
  historyScope: MaybeRefOrGetter<readonly unknown[]>;
  fetchPage: (before: string | null, signal: AbortSignal) => Promise<EventPage<E>>;
  enabled: MaybeRefOrGetter<boolean>;
}

/**
 * A newest-first event timeline: a live head page, plus older pages loaded on demand from a cursor
 * frozen when the viewer first asks for them. A live refresh costs one request however far back
 * the viewer has scrolled, and older pages, which never change, are fetched once.
 */
export function useEventFeed<E extends DeviceEvent>(options: EventFeedOptions<E>) {
  const state = shallowRef<FeedState<E>>(EMPTY_FEED);
  const headKey = computed(() => [...toValue(options.headKey)]);
  const enabled = computed(() => toValue(options.enabled));

  const head = useQuery({
    queryKey: headKey,
    queryFn: ({ signal }) => options.fetchPage(null, signal),
    enabled,
  });

  watch(
    () => JSON.stringify(headKey.value),
    () => {
      state.value = EMPTY_FEED;
    },
  );
  watch(
    () => head.data.value,
    (page) => {
      if (page) state.value = reconcileHead(state.value, page);
    },
  );

  const anchor = computed(() => state.value.anchor);
  const history = useInfiniteQuery({
    queryKey: computed(() =>
      queryKeys.eventHistory(toValue(options.historyScope), anchor.value ?? ""),
    ),
    queryFn: ({ queryKey, pageParam, signal }) =>
      options.fetchPage(pageParam || String(queryKey[queryKey.length - 1]), signal),
    initialPageParam: "",
    getNextPageParam: (last: EventPage<E>) => last.next ?? undefined,
    enabled: computed(() => enabled.value && Boolean(anchor.value)),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  const events = computed(() =>
    mergeEvents(
      head.data.value?.events ?? [],
      state.value.pinned,
      ...(anchor.value ? (history.data.value?.pages.map((page) => page.events) ?? []) : []),
    ),
  );

  const hasMore = computed(() => {
    if (!anchor.value) return Boolean(head.data.value?.next);
    return history.isPending.value || Boolean(history.hasNextPage.value);
  });
  const loadingOlder = computed(() => Boolean(anchor.value) && history.isFetching.value);

  function loadOlder() {
    const page = head.data.value;
    if (!anchor.value) {
      if (page) state.value = startHistory(state.value, page);
      return;
    }
    if (history.hasNextPage.value && !history.isFetchingNextPage.value)
      void history.fetchNextPage();
  }

  return {
    events,
    isPending: head.isPending,
    isFetching: head.isFetching,
    error: head.error,
    refetch: head.refetch,
    hasMore,
    loadingOlder,
    olderError: computed(() => (anchor.value ? history.error.value : null)),
    retryOlder: () =>
      void (history.data.value?.pages.length ? history.fetchNextPage() : history.refetch()),
    loadOlder,
  };
}
