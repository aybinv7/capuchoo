<script setup lang="ts">
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const breadcrumbs = computed(() => {
  const matchedRoutes = route.matched
  const crumbs: {
    text: string
    to: string
    isCurrent: boolean
  }[] = []

  matchedRoutes.forEach((matchedRoute) => {
    if (matchedRoute.meta && matchedRoute.meta.breadcrumb) {
      const breadcrumb = matchedRoute.meta.breadcrumb
      let breadcrumbText = ''

      if (typeof breadcrumb === 'function') {
        breadcrumbText = breadcrumb(route)
      } else if (typeof breadcrumb === 'string') {
        breadcrumbText = breadcrumb
      } else {
        breadcrumbText = String(breadcrumb) || getBreadcrumbFromPath(matchedRoute.path)
      }

      if (!crumbs.some((c) => c.to === matchedRoute.path)) {
        crumbs.push({
          text: breadcrumbText,
          to: matchedRoute.path,
          isCurrent: matchedRoute.path === route.path,
        })
      }
    } else {
      const pathBreadcrumb = getBreadcrumbFromPath(matchedRoute.path)
      if (pathBreadcrumb && !crumbs.some((c) => c.to === matchedRoute.path)) {
        crumbs.push({
          text: pathBreadcrumb,
          to: matchedRoute.path,
          isCurrent: matchedRoute.path === route.path,
        })
      }
    }
  })

  if (crumbs.length === 0 && route.path !== '/') {
    const pathParts = route.path.split('/').filter((part) => part)
    let currentPath = ''

    pathParts.forEach((part) => {
      currentPath += '/' + part
      const breadcrumbText = getBreadcrumbFromPath(currentPath)

      if (!crumbs.some((c) => c.to === currentPath)) {
        crumbs.push({
          text: breadcrumbText,
          to: currentPath,
          isCurrent: currentPath === route.path,
        })
      }
    })
  }

  // if (!crumbs.some((c) => c.to === '/') && route.path !== '/') {
  //   crumbs.unshift({
  //     text: 'Home',
  //     to: '/',
  //     isCurrent: false,
  //   })
  // }

  // if (crumbs.length === 0 && route.path === '/') {
  //   crumbs.push({
  //     text: 'Home',
  //     to: '/',
  //     isCurrent: true,
  //   })
  // }

  return crumbs
})

const getBreadcrumbFromPath = (path: string) => {
  if (!path || path === '/') return 'Home'

  const segments = path.split('/').filter((segment) => segment)
  if (segments.length === 0) return 'Home'

  const lastSegment = segments[segments.length - 1]

  return lastSegment
    ? lastSegment
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Page'
}
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList>
      <template v-for="(crumb, index) in breadcrumbs" :key="index">
        <BreadcrumbItem>
          <template v-if="crumb.isCurrent">
            <BreadcrumbPage>{{ crumb.text }}</BreadcrumbPage>
          </template>
          <template v-else>
            <BreadcrumbLink :as-child="true">
              <RouterLink :to="crumb.to">{{ crumb.text }}</RouterLink>
            </BreadcrumbLink>
          </template>
        </BreadcrumbItem>
        <BreadcrumbSeparator v-if="index < breadcrumbs.length - 1" />
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
