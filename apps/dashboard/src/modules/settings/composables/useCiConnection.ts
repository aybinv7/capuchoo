import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import type { AppCi, GitlabTriggerInput } from "@/shared/types/ci";
import {
  connectGithub,
  disconnectGithub,
  removeGitlabTrigger,
  saveGitlabTrigger,
} from "../services/ci-settings.service";

/** Linking the app to a repository, and the GitLab trigger token. Each refreshes the app's CI. */
export function useCiConnection(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.appCi(toValue(appId)) });

  const connect = useMutation({
    mutationFn: (input: { installation: string; repository_id: number }) =>
      connectGithub(toValue(appId), input),
    onSuccess: (ci) => {
      client.setQueryData<AppCi>(queryKeys.appCi(toValue(appId)), ci);
      void refresh();
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectGithub(toValue(appId)),
    onSuccess: refresh,
  });

  const saveTrigger = useMutation({
    mutationFn: (input: GitlabTriggerInput) => saveGitlabTrigger(toValue(appId), input),
    onSuccess: refresh,
  });

  const removeTrigger = useMutation({
    mutationFn: () => removeGitlabTrigger(toValue(appId)),
    onSuccess: refresh,
  });

  return { connect, disconnect, saveTrigger, removeTrigger };
}
