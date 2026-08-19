<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Apps</h1>
        <p class="text-muted-foreground">Manage your applications</p>
      </div>
      <Button @click="router.push('/apps/create')">
        <ILucidePlus class="mr-2 h-4 w-4" />
        New App
      </Button>
    </div>

    <!-- Apps Grid -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <ILucideLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="apps && apps.length > 0" class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="app in apps"
        :key="app.id"
        class="hover:shadow-lg transition-shadow cursor-pointer"
        @click="selectApp(app)"
      >
        <CardHeader class="flex flex-row items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <ILucideAppWindow class="h-6 w-6 text-primary" />
          </div>
          <div class="flex-1">
            <CardTitle class="text-lg">{{ app.name }}</CardTitle>
            <CardDescription class="font-mono text-xs">{{ app.app_id }}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-4 text-sm text-muted-foreground">
            <div class="flex items-center gap-1">
              <ILucideSmartphone class="h-4 w-4" />
              <span>{{ app.total_devices ?? 0 }} devices</span>
            </div>
            <div class="flex items-center gap-1">
              <ILucideGitBranch class="h-4 w-4" />
              <span>{{ app.total_bundles ?? 0 }} bundles</span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="text-xs text-muted-foreground">
          Created {{ formatDate(app.created_at) }}
        </CardFooter>
      </Card>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <ILucideAppWindow class="h-12 w-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-semibold">No apps yet</h3>
      <p class="text-muted-foreground mb-4">Get started by creating your first app</p>
      <Button @click="router.push('/apps/create')">
        <ILucidePlus class="mr-2 h-4 w-4" />
        Create App
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppsQuery } from '@/modules/apps/composables/useAppsQuery'
import { useAppStore } from '@/stores/app.store'
import type { App } from '@/modules/apps/types/apps.types'

definePage({
  meta: {
    title: 'Apps - CapGO Updater',
    description: 'Manage your applications',
    category: 'apps',
  },
})

const router = useRouter()
const appStore = useAppStore()
const { data: apps, isLoading } = useAppsQuery()

const selectApp = (app: App) => {
  appStore.setActiveApp(app)
  router.push('/dashboard')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>
