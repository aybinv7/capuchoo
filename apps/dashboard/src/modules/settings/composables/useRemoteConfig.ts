import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import { deleteConfig, fetchConfig, saveConfig } from "../services/app-settings.service";
import type { ConfigEntry, ConfigInput } from "../types/settings.types";

/** Remote config entries: `all`, overridden per environment, overridden per channel. */
export function useRemoteConfig(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const id = () => toValue(appId);
  const key = computed(() => queryKeys.appSettings(id(), "config"));

  const entries = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchConfig(id(), signal),
    enabled: computed(() => Boolean(id())),
  });

  const save = useMutation({
    mutationFn: (input: ConfigInput) => saveConfig(id(), input),
    onSuccess: (entry) =>
      client.setQueryData<ConfigEntry[]>(key.value, (list) => {
        const rest = (list ?? []).filter((row) => row.id !== entry.id);
        return [...rest, entry].sort((a, b) => a.key.localeCompare(b.key));
      }),
  });

  const remove = useMutation({
    mutationFn: (configId: string) => deleteConfig(id(), configId),
    onSuccess: (_result, configId) =>
      client.setQueryData<ConfigEntry[]>(key.value, (list) =>
        list?.filter((row) => row.id !== configId),
      ),
    onError: notifyError,
  });

  return { entries, save, remove };
}
