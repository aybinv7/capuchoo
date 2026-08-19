import { useApiQuery } from '@/composables/api/config/useApiQuery'
import type { DashboardStats, DashboardStatsData } from '../types/statistics.types'
import type { UseQueryOptions } from '@tanstack/vue-query'

import { useAppStore } from '@/stores/app.store'
import { computed } from 'vue'
import { apiClient } from '@/services/api.client'
import { queryErrorHandler } from '@/composables/api/error/query-error-handler'

export function useDashboardStatsQuery(
  options?: Omit<UseQueryOptions<DashboardStats, Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => ['dashboard', 'stats', activeAppId.value])

  return useApiQuery<DashboardStats>(queryKey, '/dashboard/stats', {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      if (!activeAppId.value) return undefined as any
      try {
        const response = await apiClient.get(`/dashboard/stats?app_id=${activeAppId.value}`)
        return response.data
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
  })
}

export function useDashboardStatsDataQuery(
  timeRange: 'day' | 'week' | 'month' | 'year' = 'month',
  options?: Omit<UseQueryOptions<DashboardStatsData, Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => ['dashboard', 'stats-data', timeRange, activeAppId.value])

  return useApiQuery<DashboardStatsData>(queryKey, `/dashboard/stats-data?range=${timeRange}`, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      if (!activeAppId.value) return undefined as any
      try {
        const response = await apiClient.get(
          `/dashboard/stats-data?range=${timeRange}&app_id=${activeAppId.value}`,
        )
        return response.data
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
  })
}
