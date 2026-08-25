import type { UpdateLog } from "../types/update-logs.types";
import type { UseQueryOptions } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useApiQuery } from "@/composables/api/config/useApiQuery";
import { apiClient } from "@/services/api.client";
import { queryErrorHandler } from "@/composables/api/error/query-error-handler";
import { useAppStore } from "@/stores/app.store";

/**
 * Filters accept refs and getters, not plain values.
 *
 * They used to be read once, when the composable was called - so
 * `useUpdateLogsQuery({ limit: limit.value })` captured the number 100 forever.
 * "Load more" incremented the ref, refetched, and asked for the same 100 rows
 * again, which looks exactly like having reached the end of the data.
 */
export interface UpdateLogsFilters {
  /** Bundle identifier, e.g. `com.efficy.app`. The server resolves it to a UUID. */
  appId?: MaybeRefOrGetter<string | undefined>;
  deviceId?: MaybeRefOrGetter<string | undefined>;
  limit?: MaybeRefOrGetter<number | undefined>;
}

export function useUpdateLogsQuery(
  filters?: UpdateLogsFilters,
  options?: Omit<UseQueryOptions<UpdateLog[], Error>, "queryKey" | "queryFn">,
) {
  const appStore = useAppStore();

  /**
   * An explicit filter wins; otherwise the app selected in the sidebar.
   *
   * The empty string is meaningful and distinct from undefined: it is the
   * "All apps" choice, and it must suppress the store fallback rather than fall
   * through to it, or that option would silently show one app's logs.
   */
  const appId = computed(() => {
    const explicit = toValue(filters?.appId);
    return explicit === undefined ? appStore.activeApp?.app_id : explicit || undefined;
  });

  const deviceId = computed(() => toValue(filters?.deviceId));
  const limit = computed(() => toValue(filters?.limit) ?? 100);

  const queryKey = computed(() => [
    "update-logs",
    appId.value ?? "",
    deviceId.value ?? "",
    limit.value,
  ]);

  return useApiQuery<UpdateLog[]>(queryKey, "/dashboard/update-logs", {
    staleTime: 30 * 1000, // logs are more dynamic than the rest
    ...options,
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (appId.value) params.append("app_id", appId.value);
        if (deviceId.value) params.append("device_id", deviceId.value);
        params.append("limit", String(limit.value));

        const response = await apiClient.get(`/dashboard/update-logs?${params.toString()}`);
        return response.data;
      } catch (error) {
        throw queryErrorHandler(error);
      }
    },
  });
}
