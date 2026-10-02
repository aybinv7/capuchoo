import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { toValue, type MaybeRefOrGetter } from "vue";
import { queryKeys } from "@/shared/api/query-keys";
import { createApiKey, revokeApiKey } from "../services/account.service";
import { storeSecrets, type PlainSecret } from "../lib/store-secrets";

/**
 * Repository secrets, written without Capuchoo ever holding them. `apiKey` mints a developer key
 * limited to this app and stores it as `CAPUCHOO_API_KEY`; if storing fails the key is revoked,
 * so no usable key is left behind that nobody can see.
 */
export function useGithubSecrets(
  appId: MaybeRefOrGetter<string>,
  repository: MaybeRefOrGetter<string>,
) {
  const client = useQueryClient();
  const settled = () => {
    void client.invalidateQueries({ queryKey: queryKeys.githubSetup(toValue(appId)) });
    void client.invalidateQueries({ queryKey: queryKeys.apiKeys() });
  };

  const store = useMutation({
    mutationFn: (secrets: readonly PlainSecret[]) => storeSecrets(toValue(appId), secrets),
    onSuccess: settled,
  });

  const apiKey = useMutation({
    mutationFn: async () => {
      const created = await createApiKey({
        name: `CI · ${toValue(repository)}`.slice(0, 120),
        app_id: toValue(appId),
        role: "developer",
      });
      try {
        await storeSecrets(toValue(appId), [{ name: "CAPUCHOO_API_KEY", value: created.key }]);
      } catch (error) {
        await revokeApiKey(created.id).catch(() => undefined);
        throw error;
      }
      return { id: created.id, name: created.name, key_prefix: created.key_prefix };
    },
    onSettled: settled,
  });

  return { store, apiKey };
}
