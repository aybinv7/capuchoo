import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchStats } from "../services/insight.service";
import type { ChannelStats } from "../types/stats";

/** `GET /api/apps/:id/stats` for a window of days, with per-channel health indexed by channel id. */
export function useAppStats(appId: MaybeRefOrGetter<string>, days: MaybeRefOrGetter<number> = 30) {
  const query = useQuery({
    queryKey: computed(() => queryKeys.stats(toValue(appId), toValue(days))),
    queryFn: ({ signal }) => fetchStats(toValue(appId), toValue(days), signal),
    enabled: computed(() => Boolean(toValue(appId))),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const byChannel = computed(() => {
    const map = new Map<string, ChannelStats>();
    for (const row of query.data.value?.channels ?? []) map.set(row.channel_id, row);
    return map;
  });
  return { ...query, byChannel };
}
