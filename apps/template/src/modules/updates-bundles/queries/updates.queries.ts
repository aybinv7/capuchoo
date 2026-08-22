import { useQuery } from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue, computed } from "vue";
import { apiClient } from "@/shared/services/api.client";
import { queryErrorHandler } from "@/shared/composables/api/error/query-error-handler";
import type { UpdateOrBundle } from "@/shared/types/models";
import { useAppStore } from "@/shared/stores/app.store";
import { useApiMutation } from "@/shared/composables/api/useApiMutation";

export function useDeleteBundleMutation() {
  return useApiMutation<void, string>("");
}

export function usePromoteBundleMutation() {
  return useApiMutation<
    UpdateOrBundle,
    { id: string; target_app_id: string; target_channel: string }
  >("", "post");
}

// Custom mutation functions for dynamic IDs
export function deleteBundle(id: string) {
  return apiClient.delete(`/dashboard/bundles/${id}`);
}

export function promoteBundle(id: string, target_app_id: string, target_channel: string) {
  return apiClient.post(`/dashboard/bundles/${id}/promote`, {
    target_app_id,
    target_channel,
  });
}

export function createBundle(data: any) {
  return apiClient.post("/dashboard/bundles", data);
}

export const UPDATES_KEY = "updates-bundles";

export function useUpdatesQuery(appIdRef: MaybeRefOrGetter<string | undefined>) {
  return useQuery<UpdateOrBundle[], Error>({
    queryKey: [UPDATES_KEY, computed(() => toValue(appIdRef))],
    queryFn: async () => {
      const appId = toValue(appIdRef);
      if (!appId) return [];

      try {
        const [nativeResponse, bundleResponse] = await Promise.all([
          apiClient.get(`/dashboard/native-updates?app_id=${appId}`),
          apiClient.get(`/dashboard/bundles?app_id=${appId}`),
        ]);

        const nativeUpdates: UpdateOrBundle[] = Array.isArray(nativeResponse.data)
          ? nativeResponse.data.map((update: any) => ({
              ...update,
              id: update.id.toString(),
              type: "native" as const,
            }))
          : [];

        const bundles: UpdateOrBundle[] = Array.isArray(bundleResponse.data)
          ? bundleResponse.data.map((bundle: any) => ({
              ...bundle,
              id: bundle.id.toString(),
              type: "bundle" as const,
              version_code: undefined,
              file_size: undefined,
              release_notes: undefined,
            }))
          : [];

        return [...nativeUpdates, ...bundles].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      } catch (error) {
        throw queryErrorHandler(error);
      }
    },
    enabled: computed(() => !!toValue(appIdRef)),
  });
}

export function useUpdateQuery(id: string, type: "bundle" | "native" = "bundle") {
  const appStore = useAppStore();
  const activeAppId = computed(() => appStore.activeApp?.app_id);

  const { data: updates, isLoading, refetch } = useUpdatesQuery(activeAppId);

  const item = computed(() => {
    return updates.value?.find((i) => i.id === id && i.type === type);
  });

  return {
    data: item,
    isLoading,
    refetch,
  };
}

export function useBundleQuery(id: string) {
  return useUpdateQuery(id, "bundle");
}

export function useNativeUpdateQuery(id: string) {
  return useUpdateQuery(id, "native");
}
