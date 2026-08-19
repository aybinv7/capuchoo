import { useAppStore } from '@/stores/app.store'
import { computed } from 'vue'
import { apiClient } from '@/services/api.client'
import { useApiQuery, useApiMutation } from '@/composables/api/config/useApiQuery'
import { queryErrorHandler } from '@/composables/api/error/query-error-handler'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/vue-query'

export function useDevicesQuery(
  options?: Omit<UseQueryOptions<Device[], Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => ['devices', activeAppId.value])

  return useApiQuery<Device[]>(queryKey, '/dashboard/devices', {
    staleTime: 5 * 60 * 1000,
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      if (!activeAppId.value) return []
      try {
        const response = await apiClient.get(`/dashboard/devices?app_id=${activeAppId.value}`)
        return response.data
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
  })
}

export function useDeleteDeviceMutation(
  options?: Omit<UseMutationOptions<void, Error, string>, 'mutationFn'>,
) {
  return useApiMutation<void, string>('', 'delete', {
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/dashboard/devices/${id}`)
      return response.data
    },
    ...options,
  })
}

export function useUpdateDeviceChannelMutation(
  options?: Omit<UseMutationOptions<Device, Error, { id: string; channel: string }>, 'mutationFn'>,
) {
  return useApiMutation<Device, { id: string; channel: string }>('', 'put', {
    mutationFn: async ({ id, channel }: { id: string; channel: string }) => {
      const response = await apiClient.put(`/dashboard/devices/${id}/channel`, { channel })
      return response.data
    },
    ...options,
  })
}
