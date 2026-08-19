<template>
  <div class="space-y-6">
    <div v-if="!activeApp" class="flex flex-col items-center justify-center py-12 text-center">
      <ILucideAppWindow class="h-12 w-12 text-muted-foreground mb-4" />
      <h3 class="text-lg font-semibold">No app selected</h3>
      <p class="text-muted-foreground mb-4">
        Select an app from the sidebar to view its dashboard.
      </p>
    </div>

    <div v-else class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <div
              v-if="activeApp.icon_url"
              class="h-12 w-12 rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg"
            >
              <img
                :src="activeApp.icon_url"
                :alt="activeApp.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div
              v-else
              class="h-12 w-12 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20"
            >
              <ILucideAppWindow class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 class="text-2xl font-bold tracking-tight">{{ activeApp.name }}</h1>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <code class="bg-muted px-2 py-0.5 rounded text-xs">{{ activeApp.app_id }}</code>
                <Badge v-if="activeApp.platform" variant="secondary" class="text-xs">
                  {{ activeApp.platform }}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card class="overflow-hidden">
          <div class="h-1 bg-linear-to-r from-blue-500 to-blue-600" />
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Total Devices</CardTitle>
            <ILucideSmartphone class="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ activeApp.total_devices ?? 0 }}</div>
            <p class="text-xs text-muted-foreground mt-1">Active installations</p>
          </CardContent>
        </Card>
        <Card class="overflow-hidden">
          <div class="h-1 bg-linear-to-r from-emerald-500 to-emerald-600" />
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Bundles</CardTitle>
            <ILucidePackage class="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ activeApp.total_bundles ?? 0 }}</div>
            <p class="text-xs text-muted-foreground mt-1">OTA updates uploaded</p>
          </CardContent>
        </Card>
        <Card class="overflow-hidden">
          <div class="h-1 bg-linear-to-r from-violet-500 to-violet-600" />
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Channels</CardTitle>
            <ILucideRadio class="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ channelCount }}</div>
            <p class="text-xs text-muted-foreground mt-1">Release channels</p>
          </CardContent>
        </Card>
        <Card class="overflow-hidden">
          <div class="h-1 bg-linear-to-r from-amber-500 to-amber-600" />
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Created</CardTitle>
            <ILucideClock class="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div class="text-xl font-bold">{{ formatDate(activeApp.created_at) }}</div>
            <p class="text-xs text-muted-foreground mt-1">
              {{ formatRelativeTime(activeApp.created_at) }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <!-- SDK Configuration -->
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <ILucideCode class="h-5 w-5" />
                SDK Configuration
              </CardTitle>
              <CardDescription>
                Copy these settings to your <code>capacitor.config.ts</code> file to enable OTA
                updates for this app.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-50 relative group">
                <Button
                  variant="ghost"
                  size="icon"
                  class="absolute right-2 top-2 h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="copySnippet"
                >
                  <ILucideCopy class="h-4 w-4" />
                </Button>
                <pre class="overflow-x-auto"><code>{{ sdkSnippet }}</code></pre>
              </div>

              <Alert>
                <ILucideInfo />
                <AlertTitle>
                  Ensure you have the @capgo/capacitor-updater plugin installed in your project.
                </AlertTitle>
              </Alert>
            </CardContent>
          </Card>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Quick Actions -->
          <Card>
            <CardHeader>
              <CardTitle class="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <Button
                class="w-full justify-start"
                variant="outline"
                @click="router.push(`/channels`)"
              >
                <ILucideRadio class="mr-2 h-4 w-4" />
                Manage Channels
              </Button>
              <Button
                class="w-full justify-start"
                variant="outline"
                @click="router.push(`/updates-bundles`)"
              >
                <ILucidePackage class="mr-2 h-4 w-4" />
                Manage Bundles
              </Button>
              <Button
                class="w-full justify-start"
                variant="outline"
                @click="router.push(`/devices`)"
              >
                <ILucideSmartphone class="mr-2 h-4 w-4" />
                View Devices
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app.store'
import { toast } from 'vue-sonner'

const router = useRouter()
const appStore = useAppStore()
const { activeApp } = storeToRefs(appStore)

definePage({
  meta: {
    title: 'Dashboard',
    description: 'App Overview',
  },
})

const channelCount = computed(() => 0) // TODO: Fetch from API context-aware

const sdkSnippet = computed(() => {
  const apiBase = window.location.origin.replace(/:\d+$/, ':3000') + '/api'
  return `import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${activeApp.value?.app_id || 'com.example.app'}',
  appName: '${activeApp.value?.name || 'My App'}',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      statsUrl: '${apiBase}/stats',
      updateUrl: '${apiBase}/update'
    }
  }
};

export default config;`
})

const copySnippet = async () => {
  try {
    await navigator.clipboard.writeText(sdkSnippet.value)
    toast.success('Configuration snippet copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString()
}

const formatRelativeTime = (dateString?: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}
</script>
