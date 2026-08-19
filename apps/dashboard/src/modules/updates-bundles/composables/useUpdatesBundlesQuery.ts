import { apiClient } from '@/services/api.client'
import type { UpdateOrBundle, Bundle, NativeUpdate } from '../types/updates-bundles.types'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/vue-query'
import { useApiQuery, useApiMutation } from '@/composables/api/config/useApiQuery'
import { useApiFormDataMutation } from '@/composables/api/config/useApiFormDataMutation'
import { queryErrorHandler } from '@/composables/api/error/query-error-handler'

import { useAppStore } from '@/stores/app.store'
import { computed } from 'vue'

// Combined query for both bundles and native updates
export function useUpdatesBundlesQuery(
  options?: Omit<UseQueryOptions<UpdateOrBundle[], Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => ['updates-bundles', activeAppId.value])

  return useApiQuery<UpdateOrBundle[]>(queryKey, '/dashboard/updates-bundles', {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      try {
        if (!activeAppId.value) return []

        // Fetch both native updates and regular bundles
        const [nativeResponse, bundleResponse] = await Promise.all([
          apiClient.get(`/dashboard/native-updates?app_id=${activeAppId.value}`),
          apiClient.get(`/dashboard/bundles?app_id=${activeAppId.value}`),
        ])

        // Convert native updates to UpdateOrBundle type
        const nativeUpdates: UpdateOrBundle[] = Array.isArray(nativeResponse.data)
          ? nativeResponse.data.map((update: any) => ({
              ...update,
              id: update.id.toString(),
              type: 'native' as const,
            }))
          : []

        // Convert bundles to UpdateOrBundle type
        const bundles: UpdateOrBundle[] = Array.isArray(bundleResponse.data)
          ? bundleResponse.data.map((bundle: any) => ({
              ...bundle,
              id: bundle.id.toString(),
              type: 'bundle' as const,
              version_code: undefined, // bundles don't have version_code
              file_size: undefined, // bundles don't have file_size
              release_notes: undefined, // bundles don't have release notes
            }))
          : []

        // Combine both arrays
        return [...nativeUpdates, ...bundles]
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
  })
}

// Individual queries
export function useBundlesQuery(
  options?: Omit<UseQueryOptions<Bundle[], Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => ['bundles', activeAppId.value])

  return useApiQuery<Bundle[]>(queryKey, '/dashboard/bundles', {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      if (!activeAppId.value) return []
      const response = await apiClient.get(`/dashboard/bundles?app_id=${activeAppId.value}`)
      return response.data
    },
  })
}

export function useBundleQuery(
  id: string | number,
  options?: Omit<UseQueryOptions<Bundle, Error>, 'queryKey' | 'queryFn'>,
) {
  return useApiQuery<Bundle>(['bundles', id], `/dashboard/bundles/${id}`, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

export function useCreateBundleMutation(
  options?: Omit<UseMutationOptions<Bundle, Error, Partial<Bundle>>, 'mutationFn'>,
) {
  return useApiMutation<Bundle, Partial<Bundle>>('/dashboard/bundles', 'post', {
    ...options,
  })
}

export function useCreateBundleFormDataMutation(
  options?: Omit<UseMutationOptions<Bundle, Error, FormData>, 'mutationFn'>,
) {
  return useApiFormDataMutation<Bundle, FormData>('/dashboard/bundles', 'post', {
    ...options,
  })
}

export function useUpdateBundleMutation(
  options?: Omit<
    UseMutationOptions<Bundle, Error, { id: string | number; data: Partial<Bundle> }>,
    'mutationFn'
  >,
) {
  return useApiMutation<Bundle, { id: string | number; data: Partial<Bundle> }>('', 'put', {
    mutationFn: async ({ id, data }: { id: string | number; data: Partial<Bundle> }) => {
      const response = await apiClient.put(`/dashboard/bundles/${id}`, data)
      return response.data
    },
    ...options,
  })
}

export function useDeleteBundleMutation(
  options?: Omit<UseMutationOptions<void, Error, string | number>, 'mutationFn'>,
) {
  return useApiMutation<void, string | number>('', 'delete', {
    mutationFn: async (id: string | number) => {
      const response = await apiClient.delete(`/dashboard/bundles/${id}`)
      return response.data
    },
    ...options,
  })
}

export function usePromoteBundleMutation(
  options?: Omit<
    UseMutationOptions<
      Bundle,
      Error,
      { id: string | number; target_app_id: string; target_channel: string }
    >,
    'mutationFn'
  >,
) {
  return useApiMutation<
    Bundle,
    { id: string | number; target_app_id: string; target_channel: string }
  >('', 'post', {
    mutationFn: async ({ id, target_app_id, target_channel }) => {
      const response = await apiClient.post(`/dashboard/bundles/${id}/promote`, {
        target_app_id,
        target_channel,
      })
      return response.data
    },
    ...options,
  })
}

// Native updates queries
export function useNativeUpdatesQuery(
  options?: Omit<UseQueryOptions<NativeUpdate[], Error>, 'queryKey' | 'queryFn'>,
) {
  const appStore = useAppStore()
  const activeAppId = computed(() => appStore.activeApp?.app_id)

  const queryKey = computed(() => ['native-updates', activeAppId.value])

  return useApiQuery<NativeUpdate[]>(queryKey, '/dashboard/native-updates', {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
    enabled: computed(() => !!activeAppId.value),
    queryFn: async () => {
      if (!activeAppId.value) return []
      const response = await apiClient.get(`/dashboard/native-updates?app_id=${activeAppId.value}`)
      return response.data
    },
  })
}

export function useNativeUpdateQuery(
  id: string | number,
  options?: Omit<UseQueryOptions<NativeUpdate, Error>, 'queryKey' | 'queryFn'>,
) {
  return useApiQuery<NativeUpdate>(['native-updates', id], `/dashboard/native-updates/${id}`, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

export function useCreateNativeUpdateMutation(
  options?: Omit<UseMutationOptions<NativeUpdate, Error, Partial<NativeUpdate>>, 'mutationFn'>,
) {
  return useApiMutation<NativeUpdate, Partial<NativeUpdate>>('/admin/native-upload', 'post', {
    ...options,
  })
}

export function useCreateNativeUpdateFormDataMutation(
  options?: Omit<UseMutationOptions<NativeUpdate, Error, FormData>, 'mutationFn'>,
) {
  return useApiFormDataMutation<NativeUpdate, FormData>('/admin/native-upload', 'post', {
    ...options,
  })
}

export function useUpdateNativeUpdateMutation(
  options?: Omit<
    UseMutationOptions<NativeUpdate, Error, { id: string | number; data: Partial<NativeUpdate> }>,
    'mutationFn'
  >,
) {
  return useApiMutation<NativeUpdate, { id: string | number; data: Partial<NativeUpdate> }>(
    '',
    'put',
    {
      mutationFn: async ({ id, data }: { id: string | number; data: Partial<NativeUpdate> }) => {
        const response = await apiClient.put(`/dashboard/native-updates/${id}`, data)
        return response.data
      },
      ...options,
    },
  )
}

export function useDeleteNativeUpdateMutation(
  options?: Omit<UseMutationOptions<void, Error, string | number>, 'mutationFn'>,
) {
  return useApiMutation<void, string | number>('', 'delete', {
    mutationFn: async (id: string | number) => {
      const response = await apiClient.delete(`/dashboard/native-updates/${id}`)
      return response.data
    },
    ...options,
  })
}
