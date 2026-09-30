import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { connectGitlab, disconnectGitlab, fetchGitlab } from "../services/app-settings.service";

/** The GitLab webhook. Connecting (again) mints a new secret and invalidates the previous one. */
export function useGitlab(appId: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean>) {
  const client = useQueryClient();
  const id = () => toValue(appId);
  const key = computed(() => queryKeys.appSettings(id(), "gitlab"));
  const refresh = () => client.invalidateQueries({ queryKey: key.value });

  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchGitlab(id(), signal),
    enabled: computed(() => Boolean(id()) && toValue(enabled)),
  });

  const connect = useMutation({
    mutationFn: (project: string | null) => connectGitlab(id(), project),
    onSuccess: refresh,
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectGitlab(id()),
    onSuccess: refresh,
  });

  return { status, connect, disconnect };
}
