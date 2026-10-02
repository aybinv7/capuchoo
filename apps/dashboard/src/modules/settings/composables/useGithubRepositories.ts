import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { computed, toValue, type MaybeRefOrGetter, type Ref } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchRepositories } from "../services/ci-settings.service";

const SEARCH_DEBOUNCE_MS = 300;

/** Repositories an installation can reach, searched on the server as the person types. */
export function useGithubRepositories(
  organizationId: MaybeRefOrGetter<string>,
  installationId: MaybeRefOrGetter<string | null>,
  search: Ref<string>,
) {
  const debounced = refDebounced(search, SEARCH_DEBOUNCE_MS);
  const term = computed(() => debounced.value.trim());
  return useQuery({
    queryKey: computed(() =>
      queryKeys.githubRepositories(
        toValue(organizationId),
        toValue(installationId) ?? "",
        term.value,
      ),
    ),
    queryFn: ({ signal }) =>
      fetchRepositories(toValue(organizationId), toValue(installationId) ?? "", term.value, signal),
    enabled: computed(() => Boolean(toValue(organizationId) && toValue(installationId))),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
