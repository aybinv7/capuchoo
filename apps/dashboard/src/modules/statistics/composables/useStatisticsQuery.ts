import { useApiQuery } from "@/composables/api/config/useApiQuery";
import type { DashboardStats, DashboardStatsData } from "../types/statistics.types";
import type { UseQueryOptions } from "@tanstack/vue-query";

import { useAppStore } from "@/stores/app.store";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { apiClient } from "@/services/api.client";
import { queryErrorHandler } from "@/composables/api/error/query-error-handler";

export function useDashboardStatsQuery(
  options?: Omit<UseQueryOptions<DashboardStats, Error>, "queryKey" | "queryFn">,
) {
  const appStore = useAppStore();
  const activeAppId = computed(() => appStore.activeApp?.app_id);

  const queryKey = computed(() => ["dashboard", "stats", activeAppId.value]);

  return useApiQuery<DashboardStats>(queryKey, "/dashboard/stats", {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      if (!activeAppId.value) return undefined as any;
      try {
        const response = await apiClient.get(`/dashboard/stats?app_id=${activeAppId.value}`);
        return response.data;
      } catch (error) {
        throw queryErrorHandler(error);
      }
    },
  });
}

export type StatsRange = "day" | "week" | "month" | "year";

/**
 * The range is reactive.
 *
 * It used to be a plain string parameter, so the query key was fixed at the
 * value passed on first render and changing the selector refetched nothing.
 * The page never noticed, because it never called this function at all - the
 * charts were hard-coded fixtures and the selector was wired to nothing.
 */
export function useDashboardStatsDataQuery(
  range: MaybeRefOrGetter<StatsRange> = "month",
  options?: Omit<UseQueryOptions<DashboardStatsData, Error>, "queryKey" | "queryFn">,
) {
  const appStore = useAppStore();
  const activeAppId = computed(() => appStore.activeApp?.app_id);
  const timeRange = computed(() => toValue(range));

  const queryKey = computed(() => ["dashboard", "stats-data", timeRange.value, activeAppId.value]);

  return useApiQuery<DashboardStatsData>(
    queryKey,
    computed(() => `/dashboard/stats-data?range=${timeRange.value}`),
    {
      staleTime: 5 * 60 * 1000,
      ...options,
      enabled: computed(() => !!activeAppId.value),
      queryFn: async () => {
        if (!activeAppId.value) return undefined as any;
        try {
          const response = await apiClient.get(
            `/dashboard/stats-data?range=${timeRange.value}&app_id=${activeAppId.value}`,
          );
          return response.data;
        } catch (error) {
          throw queryErrorHandler(error);
        }
      },
    },
  );
}
