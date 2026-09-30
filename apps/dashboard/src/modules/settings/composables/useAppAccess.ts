import type { AppRole } from "@capuchoo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import {
  fetchPermissions,
  grantPermission,
  revokePermission,
} from "../services/app-settings.service";

/** Direct app roles. Org owners and admins are app admins already and do not appear here. */
export function useAppAccess(appId: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean>) {
  const client = useQueryClient();
  const id = () => toValue(appId);
  const key = computed(() => queryKeys.appSettings(id(), "permissions"));
  const refresh = () => client.invalidateQueries({ queryKey: key.value });

  const permissions = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchPermissions(id(), signal),
    enabled: computed(() => Boolean(id()) && toValue(enabled)),
  });

  const grant = useMutation({
    mutationFn: ({ email, role }: { email: string; role: AppRole }) =>
      grantPermission(id(), email, role),
    onSuccess: refresh,
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokePermission(id(), userId),
    onSuccess: refresh,
    onError: notifyError,
  });

  return { permissions, grant, revoke };
}
