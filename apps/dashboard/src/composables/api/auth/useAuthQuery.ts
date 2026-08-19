import { authService, type LoginCredentials, type RegisterData } from '@/services/auth.service'
import type { UseMutationOptions } from '@tanstack/vue-query'
import { useMutation } from '@tanstack/vue-query'

export function useLoginMutation(
  options?: Omit<
    UseMutationOptions<{ user: any; session: any }, Error, LoginCredentials>,
    'mutationFn'
  >,
) {
  return useMutation<{ user: any; session: any }, Error, LoginCredentials>({
    mutationFn: async (credentials: LoginCredentials) => {
      try {
        return await authService.login(credentials)
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
    ...options,
  })
}

export function useRegisterMutation(
  options?: Omit<UseMutationOptions<{ user: any }, Error, RegisterData>, 'mutationFn'>,
) {
  return useMutation<{ user: any }, Error, RegisterData>({
    mutationFn: async (data: RegisterData) => {
      try {
        return await authService.register(data)
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
    ...options,
  })
}

export function useLogoutMutation(
  options?: Omit<UseMutationOptions<void, Error, void>, 'mutationFn'>,
) {
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      try {
        await authService.logout()
      } catch (error) {
        throw queryErrorHandler(error)
      }
    },
    ...options,
  })
}
