import { useQueries } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { servedByBaseIds } from "@/shared/delivery/lib/eligibility";
import { HISTORY_LIMIT } from "@/shared/queries/useChannelQueries";
import { fetchChannelHistory } from "@/shared/services/release.service";
import type { Channel } from "@/shared/types/release";

/**
 * What each base channel has served, for every base some client channel follows. One history
 * request per base, shared with the channel pages through the query cache.
 */
export function useServedByBases(channels: MaybeRefOrGetter<readonly Channel[]>) {
  const baseIds = computed(() => [
    ...new Set(
      toValue(channels)
        .filter((channel) => channel.kind === "client" && channel.base_channel_id)
        .map((channel) => channel.base_channel_id as string),
    ),
  ]);

  const histories = useQueries({
    queries: computed(() =>
      baseIds.value.map((id) => ({
        queryKey: queryKeys.channelHistory(id),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchChannelHistory(id, HISTORY_LIMIT, signal),
      })),
    ),
  });

  return computed(() => {
    const map = new Map<string, Set<string>>();
    const all = toValue(channels);
    baseIds.value.forEach((id, index) => {
      const base = all.find((channel) => channel.id === id);
      map.set(id, servedByBaseIds(base, histories.value[index]?.data ?? []));
    });
    return map;
  });
}
