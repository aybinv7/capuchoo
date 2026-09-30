import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { fetchSigning, updateSigning } from "../services/app-settings.service";
import type { Signing } from "../types/settings.types";

export function useSigning(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const id = () => toValue(appId);
  const key = computed(() => queryKeys.appSettings(id(), "signing"));

  const signing = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchSigning(id(), signal),
    enabled: computed(() => Boolean(id())),
  });

  const save = useMutation({
    mutationFn: (input: { public_key: string | null; require_signature: boolean }) =>
      updateSigning(id(), input),
    onSuccess: (result) => {
      client.setQueryData<Signing>(key.value, result);
      void client.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });

  return { signing, save };
}
