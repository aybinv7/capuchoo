import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchRecorderHealth } from "../services/recordings.service";

/** Kept fresh by the app stream; the interval covers a dashboard whose stream dropped. */
const REFETCH_MS = 30_000;

export function useRecorderHealth(appId: MaybeRefOrGetter<string>) {
  const query = useQuery({
    queryKey: computed(() => queryKeys.recorderHealth(toValue(appId))),
    queryFn: ({ signal }) => fetchRecorderHealth(toValue(appId), signal),
    enabled: computed(() => Boolean(toValue(appId))),
    refetchInterval: REFETCH_MS,
  });
  const devices = computed(() => query.data.value ?? []);
  return { query, devices };
}
