import { keepPreviousData, useInfiniteQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchRecordings } from "../services/recordings.service";
import type { RecordingFilters } from "../types/recordings.types";

export function useRecordings(
  appId: MaybeRefOrGetter<string>,
  filters: MaybeRefOrGetter<RecordingFilters>,
) {
  const query = useInfiniteQuery({
    queryKey: computed(() => queryKeys.recordings(toValue(appId), { ...toValue(filters) })),
    queryFn: ({ pageParam, signal }) =>
      fetchRecordings(toValue(appId), toValue(filters), pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: computed(() => Boolean(toValue(appId))),
    placeholderData: keepPreviousData,
  });

  const sessions = computed(() => query.data.value?.pages.flatMap((page) => page.sessions) ?? []);
  return { query, sessions };
}
