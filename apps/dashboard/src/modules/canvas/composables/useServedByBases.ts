import { useQueries } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { servedByBaseIds } from "@/shared/delivery/lib/eligibility";
import { fetchServedArtefacts } from "@/shared/services/release.service";
import type { Channel } from "@/shared/types/release";

/**
 * What each base channel has served, for every base some client channel follows. One request
 * per base, shared with the channel pages through the query cache.
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
        queryKey: queryKeys.channelServed(id),
        queryFn: ({ signal }: { signal: AbortSignal }) => fetchServedArtefacts(id, signal),
      })),
    ),
  });

  return computed(() => {
    const map = new Map<string, Set<string>>();
    const all = toValue(channels);
    baseIds.value.forEach((id, index) => {
      const base = all.find((channel) => channel.id === id);
      const ids = histories.value[index]?.data ?? [];
      map.set(
        id,
        servedByBaseIds(
          base,
          ids.map((artefactId) => ({ to_id: artefactId })),
        ),
      );
    });
    return map;
  });
}
