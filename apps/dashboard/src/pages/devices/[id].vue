<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h1 class="text-3xl font-bold tracking-tight font-mono text-primary">
            {{ device?.device_id }}
          </h1>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground text-sm">
          <IStreamlineLogosAndroidLogoBlock v-if="device?.platform === 'android'" class="w-4 h-4" />
          <IStreamlineLogosAppleLogoBlock v-if="device?.platform === 'ios'" class="w-4 h-4" />
          <span class="capitalize">{{ device?.platform }}</span>
          <span>•</span>
          <span>Last seen {{ formatDate(device?.last_check, true) }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm">
          <ILucideRefreshCcw class="mr-2 h-4 w-4" />
          Sync
        </Button>
        <Button variant="destructive" size="sm">
          <ILucideTrash2 class="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Channel</CardTitle>
          <Radio class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold capitalize">{{ device?.channel || 'Production' }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Current Version</CardTitle>
          <GitCommit class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ device?.current_bundle_id || 'N/A' }}</div>
          <p class="text-xs text-muted-foreground">Bundle ID</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Native Version</CardTitle>
          <Smartphone class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ device?.current_native_id || 'N/A' }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Model</CardTitle>
          <Cpu class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">Unknown</div>
          <p class="text-xs text-muted-foreground">Device Model</p>
        </CardContent>
      </Card>
    </div>

    <!-- Content -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="md:col-span-2 space-y-6">
        <!-- Update History (Mocked for now as we don't store history yet) -->
        <Card>
          <CardHeader>
            <CardTitle>Update History</CardTitle>
            <CardDescription>Recent updates applied to this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="relative pl-6 border-l-2 border-muted space-y-8">
              <div v-for="(event, i) in mockHistory" :key="i" class="relative">
                <div
                  class="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-primary border-4 border-background"
                />
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">Updated to v{{ event.version }}</span>
                    <Badge variant="outline" class="text-xs">{{ event.type }}</Badge>
                  </div>
                  <div class="text-sm text-muted-foreground">{{ event.date }}</div>
                </div>
              </div>
              <!-- Initial Install -->
              <div class="relative">
                <div
                  class="absolute -left-[29px] top-1 h-3 w-3 rounded-full bg-muted border-4 border-background"
                />
                <div class="space-y-1">
                  <div class="font-medium">Device Registered</div>
                  <div class="text-sm text-muted-foreground">
                    {{ formatDate(device?.created_at, true) }}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- JSON Dump -->
        <Card>
          <CardHeader>
            <CardTitle>Raw Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto">
              <pre>{{ JSON.stringify(device, null, 2) }}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Mini Map -->
        <Card class="overflow-hidden border-border/50">
          <CardTitle class="text-sm font-medium">Location</CardTitle>
          <CardContent class="p-0">
            <div class="h-[300px] relative">
              <DevicesMap
                v-if="device"
                :items="[device]"
                :show-controls="false"
                class="h-full w-full rounded-none"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div class="flex items-center gap-2">
              <ILucideActivity class="h-5 w-5 animate-pulse text-green-600" />
              <span class="font-medium">Healthy</span>
            </div>
            <p class="text-xs mt-2">Device is communicating regularly with the server.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { id: deviceId } = defineProps<{
  id: string
}>()

const { data: devices } = useDevicesQuery()

const device = computed(() => devices.value?.find((d) => String(d.id) === deviceId))

const mockHistory = [
  { version: '1.2.0', type: 'Bundled', date: '2 hours ago' },
  { version: '1.1.0', type: 'Native', date: 'Yesterday' },
]

const formatDate = (dateString?: string, time = false) => {
  if (!dateString) return 'Unknown date'
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  if (time) {
    opts.hour = '2-digit'
    opts.minute = '2-digit'
  }
  return new Date(dateString).toLocaleDateString(undefined, opts)
}

definePage({
  meta: {
    title: 'Device Details - CapGO',
    category: 'devices',
  },
  props: true,
})
</script>
