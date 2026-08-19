import type { UseMutationOptions } from '@tanstack/vue-query'
import { useMutation } from '@tanstack/vue-query'
import { apiClient } from '@/services/api.client'
import { queryErrorHandler } from '../error/query-error-handler'

export function useApiFormDataMutation<TData = unknown, TVariables = unknown>(
  url: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      try {
        const config = {
          headers: {},
        }

        let response
        switch (method) {
          case 'post':
            response = await apiClient.post(url, variables, config)
            break
          case 'put':
            response = await apiClient.put(url, variables, config)
            break
          case 'patch':
            response = await apiClient.patch(url, variables, config)
            break
          case 'delete':
            response = await apiClient.delete(url, config)
            break
          default:
            throw new Error(`Unsupported method: ${method}`)
        }
        return response.data
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
    ...options,
  })
}
