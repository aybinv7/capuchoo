import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { organizationService } from '@/services/organization.service'
import type { CreateOrganizationDto } from '@/services/organization.service'
import type { Organization } from '@/types/models'

export const useOrganizationsQuery = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationService.getAll(),
  })
}

export const useOrganizationQuery = (id: string) => {
  return useQuery({
    queryKey: ['organizations', id],
    queryFn: () => organizationService.getById(id),
    enabled: !!id,
  })
}

export const useCreateOrganizationMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOrganizationDto) => organizationService.create(data),
    onSuccess: (newItem: Organization) => {
      // Use 'newItem' to avoid shadowing type
      // Optimistic update or just invalidation
      queryClient.setQueryData<Organization[]>(['organizations'], (old) => {
        return old ? [...old, newItem] : [newItem]
      })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}
