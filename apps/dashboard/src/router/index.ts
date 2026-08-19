import { createRouter, createWebHistory, type RouteRecord } from 'vue-router'
import { handleHotUpdate, routes } from 'vue-router/auto-routes'

import { setupLayouts } from 'layouts-generated'
import { useAuthGuard } from './guards/auth.guard'

export const router = createRouter({
  history: createWebHistory(),
  routes: setupLayouts(routes as RouteRecord[]),
})
router.beforeEach(useAuthGuard)

if (import.meta.hot) {
  handleHotUpdate(router)
}
export default router
