import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchRecordingStats } from "../services/recording-insight.service";

/** `GET /api/apps/:id/recording-stats` for a window of days; recordings are kept 14 of them. */
export function useRecordingStats(
  appId: MaybeRefOrGetter<string>,
  days: MaybeRefOrGetter<number> = 14,
) {
  return useQuery({
    queryKey: computed(() => queryKeys.recordingStats(toValue(appId), toValue(days))),
    queryFn: ({ signal }) => fetchRecordingStats(toValue(appId), toValue(days), signal),
    enabled: computed(() => Boolean(toValue(appId))),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
