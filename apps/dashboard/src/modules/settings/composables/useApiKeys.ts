import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { queryKeys } from "@/shared/api/query-keys";
import { notifyError } from "@/shared/lib/notify";
import { createApiKey, fetchApiKeys, revokeApiKey } from "../services/account.service";
import type { ApiKey, CreateApiKeyInput } from "../types/settings.types";

/** The caller's own API keys. A created key's secret is returned to the caller and never cached. */
export function useApiKeys() {
  const client = useQueryClient();
  const keys = useQuery({
    queryKey: queryKeys.apiKeys(),
    queryFn: ({ signal }) => fetchApiKeys(signal),
  });

  const create = useMutation({
    mutationFn: (input: CreateApiKeyInput) => createApiKey(input),
    onSuccess: (created) => {
      const row: ApiKey = {
        id: created.id,
        name: created.name,
        key_prefix: created.key_prefix,
        app_id: created.app_id,
        role: created.role,
        created_at: created.created_at,
        expires_at: created.expires_at,
        last_used_at: null,
      };
      client.setQueryData<ApiKey[]>(queryKeys.apiKeys(), (list) => [row, ...(list ?? [])]);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: (_result, id) =>
      client.setQueryData<ApiKey[]>(queryKeys.apiKeys(), (list) =>
        list?.filter((key) => key.id !== id),
      ),
    onError: notifyError,
  });

  return { keys, create, revoke };
}
