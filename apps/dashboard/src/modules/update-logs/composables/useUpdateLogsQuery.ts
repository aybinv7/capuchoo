import type { UpdateLog } from '../types/update-logs.types'
import type { UseQueryOptions } from '@tanstack/vue-query'
import { useApiQuery } from '@/composables/api/config/useApiQuery'
import { apiClient } from '@/services/api.client'
import { queryErrorHandler } from '@/composables/api/error/query-error-handler'

import { useAppStore } from '@/stores/app.store'
import { computed, unref } from 'vue'

interface UpdateLogsFilters {
  app_id?: string
  device_id?: string
  limit?: number
}

// Get update logs with filters
export function useUpdateLogsQuery(
  filters?: UpdateLogsFilters,
  options?: Omit<UseQueryOptions<UpdateLog[], Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()

  // Create a computed property for the active app ID to make the query reactive to app changes
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => [
    'update-logs',
    filters?.app_id ?? activeAppId.value ?? '',
    filters?.device_id ?? '',
    filters?.limit ?? 100,
  ])

  return useApiQuery<UpdateLog[]>(queryKey, '/dashboard/update-logs', {
    staleTime: 30 * 1000, // 30 seconds - logs are more dynamic
    ...options,
    queryFn: async () => {
      try {
        const params = new URLSearchParams()

        // Use provided app_id or fall back to active app
        const appId = filters?.app_id || activeAppId.value
        if (appId) params.append('app_id', appId)

        if (filters?.device_id) params.append('device_id', filters.device_id)
        if (filters?.limit) params.append('limit', filters.limit.toString())

        const url = params.toString()
          ? `/dashboard/update-logs?${params.toString()}`
          : '/dashboard/update-logs'

        const response = await apiClient.get(url)
        return response.data
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
  })
}
