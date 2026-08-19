import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { appService } from '@/services/app.service'
import type { CreateAppDto } from '@/services/app.service'
import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'

export const useAppsQuery = (organizationId?: string) => {
  return useQuery({
    queryKey: ['apps', { organizationId }],
    queryFn: () => appService.getAll(organizationId),
  })
}

export const useAppQuery = (id: MaybeRef<string>) => {
  return useQuery({
    queryKey: ['apps', unref(id)],
    queryFn: () => {
      const resolvedId = unref(id)
      if (!resolvedId) throw new Error('App ID required')
      return appService.getById(resolvedId)
    },
    enabled: computed(() => !!unref(id)),
  })
}

export const useCreateAppMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateAppDto) => appService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
  })
}

export const useDeleteAppMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => appService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
  })
}
