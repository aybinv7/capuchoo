import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import type { SetupPullRequestInput } from "@/shared/types/ci";
import {
  fetchGithubSetup,
  openSetupPullRequest,
  putGithubVariables,
} from "../services/ci-settings.service";

/** What the repository still needs, read live from GitHub, and the two one-click fixes. */
export function useGithubSetup(
  appId: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const client = useQueryClient();
  const key = computed(() => queryKeys.githubSetup(toValue(appId)));
  const refresh = () => client.invalidateQueries({ queryKey: key.value });

  const setup = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchGithubSetup(toValue(appId), signal),
    enabled: computed(() => Boolean(toValue(appId)) && toValue(enabled)),
    staleTime: 15_000,
  });

  const pullRequest = useMutation({
    mutationFn: (input: SetupPullRequestInput) => openSetupPullRequest(toValue(appId), input),
    onSuccess: refresh,
  });

  const variable = useMutation({
    mutationFn: () => putGithubVariables(toValue(appId)),
    onSuccess: refresh,
  });

  return { setup, pullRequest, variable, refresh };
}
