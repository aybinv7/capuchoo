import { useQuery } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "../api/query-keys";
import { fetchAppCi, fetchCiRefs } from "../services/ci.service";

const CI_STALE_MS = 60_000;
const REFS_STALE_MS = 30_000;

/** Which provider the app runs on and whether a run can be started from here. */
export function useAppCi(appId: MaybeRefOrGetter<string>) {
  const query = useQuery({
    queryKey: computed(() => queryKeys.appCi(toValue(appId))),
    queryFn: ({ signal }) => fetchAppCi(toValue(appId), signal),
    enabled: computed(() => Boolean(toValue(appId))),
    staleTime: CI_STALE_MS,
  });
  return {
    ...query,
    ci: computed(() => query.data.value ?? null),
    canRun: computed(() => query.data.value?.can_run === true),
  };
}

/** Branches and tags to run on, fetched only while something asks for them. */
export function useCiRefs(appId: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: computed(() => queryKeys.ciRefs(toValue(appId))),
    queryFn: ({ signal }) => fetchCiRefs(toValue(appId), signal),
    enabled: computed(() => Boolean(toValue(appId)) && toValue(enabled)),
    staleTime: REFS_STALE_MS,
  });
}
