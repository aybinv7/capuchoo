import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { queryKeys } from "@/shared/api/query-keys";
import { createApp, createOrganization, type CreateAppInput } from "../services/apps.service";

/** Registering an app or an organization changes what `/me` lists, so both refetch it. */
export function useAppRegistration() {
  const client = useQueryClient();
  const refreshSession = () => client.invalidateQueries({ queryKey: queryKeys.me() });

  const registerApp = useMutation({
    mutationFn: (input: CreateAppInput) => createApp(input),
    onSuccess: refreshSession,
  });

  const registerOrganization = useMutation({
    mutationFn: (name: string) => createOrganization(name),
    onSuccess: refreshSession,
  });

  return { registerApp, registerOrganization };
}
