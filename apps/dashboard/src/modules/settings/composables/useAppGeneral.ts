import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import {
  addIdentifier,
  deleteApp,
  fetchAppDetail,
  fetchIdentifiers,
  removeIdentifier,
  updateApp,
} from "../services/app-settings.service";
import type { AppIdentifier, AppPatch } from "../types/settings.types";

/** Name, prod delivery role, identifiers and deletion of one app. */
export function useAppGeneral(appId: MaybeRefOrGetter<string>) {
  const client = useQueryClient();
  const id = () => toValue(appId);
  const enabled = computed(() => Boolean(id()));
  const identifiersKey = computed(() => queryKeys.appSettings(id(), "identifiers"));
  const refreshSession = () => client.invalidateQueries({ queryKey: queryKeys.me() });

  const detail = useQuery({
    queryKey: computed(() => queryKeys.appDetail(id())),
    queryFn: ({ signal }) => fetchAppDetail(id(), signal),
    enabled,
  });

  const identifiers = useQuery({
    queryKey: identifiersKey,
    queryFn: ({ signal }) => fetchIdentifiers(id(), signal),
    enabled,
  });

  const update = useMutation({
    mutationFn: (patch: AppPatch) => updateApp(id(), patch),
    onSuccess: () => {
      void refreshSession();
      void client.invalidateQueries({ queryKey: queryKeys.appDetail(id()) });
    },
    onError: notifyError,
  });

  const remove = useMutation({ mutationFn: () => deleteApp(id()) });

  const addIdentifierMutation = useMutation({
    mutationFn: (input: Pick<AppIdentifier, "bundle_id" | "platform" | "flavour">) =>
      addIdentifier(id(), input),
    onSuccess: () => client.invalidateQueries({ queryKey: identifiersKey.value }),
  });

  const removeIdentifierMutation = useMutation({
    mutationFn: (bundleId: string) => removeIdentifier(id(), bundleId),
    onSuccess: () => client.invalidateQueries({ queryKey: identifiersKey.value }),
    onError: notifyError,
  });

  return {
    detail,
    identifiers,
    update,
    remove,
    refreshSession,
    addIdentifier: addIdentifierMutation,
    removeIdentifier: removeIdentifierMutation,
  };
}
