import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchBuild, fetchBuilds } from "../services/insight.service";

export const BUILD_LIST_LIMIT = 50;

/** The latest builds of an app; the live stream keeps the list current. */
export function useBuilds(appId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => queryKeys.builds(toValue(appId))),
    queryFn: ({ signal }) => fetchBuilds(toValue(appId), BUILD_LIST_LIMIT, signal),
    enabled: computed(() => Boolean(toValue(appId))),
  });
}

/** One build with its step events. */
export function useBuild(buildId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => queryKeys.build(toValue(buildId) ?? "")),
    queryFn: ({ signal }) => fetchBuild(toValue(buildId) ?? "", signal),
    enabled: computed(() => Boolean(toValue(buildId))),
  });
}
