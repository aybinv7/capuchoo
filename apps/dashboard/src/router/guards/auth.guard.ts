import type { NavigationGuardNext, RouteLocationNormalizedGeneric } from 'vue-router'

export const useAuthGuard = (
  to: RouteLocationNormalizedGeneric,
  from: RouteLocationNormalizedGeneric,
  next: NavigationGuardNext,
) => {
  const authStore = useAuthStore()

  if (to.meta.layout === 'public') return next()

  const { isAuthenticated } = storeToRefs(authStore)
  if ((to.meta.requiresAuth === undefined || to.meta.requiresAuth) && !isAuthenticated.value) {
    next('/auth/Login')
  } else if (to.meta.requiresAuth != undefined && !to.meta.requiresAuth && isAuthenticated.value) {
    next('/dashboard')
  } else {
    next()
  }
}
