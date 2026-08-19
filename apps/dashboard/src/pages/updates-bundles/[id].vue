<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="uppercase text-xs tracking-wider">
            {{ type === 'bundle' ? 'Web Bundle' : 'Native Update' }}
          </Badge>
          <h1 class="text-3xl font-bold tracking-tight">v{{ item?.version_name }}</h1>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground text-sm">
          <span>Created {{ formatDate(item?.created_at) }}</span>
          <span v-if="item?.created_by">by {{ item.created_by }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="downloadAsset">
          <ILucideDownload class="mr-2 h-4 w-4" />
          Download
        </Button>
        <Button variant="outline" size="sm" @click="promoteDialogOpen = true">
          <ILucideZap class="mr-2 h-4 w-4 text-yellow-500" />
          Promote
        </Button>
        <Button variant="outline" size="sm">
          <ILucidePencil class="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="destructive" size="sm">
          <ILucideTrash2 class="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap gap-4 p-4 border rounded-lg bg-card">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">Platform:</span>
        <div class="flex items-center gap-1.5">
          <IStreamlineLogosAndroidLogoBlock v-if="item?.platform === 'android'" class="w-4 h-4" />
          <IStreamlineLogosAppleLogoBlock v-if="item?.platform === 'ios'" class="w-4 h-4" />
          <ILucideGlobe v-if="item?.platform === 'web'" class="w-4 h-4" />
          <span class="capitalize">{{ item?.platform }}</span>
        </div>
      </div>
      <div class="w-px h-4 bg-border my-auto"></div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">Channel:</span>
        <Badge variant="secondary" class="capitalize">{{ item?.channel }}</Badge>
        <Badge v-if="isLatest" class="bg-green-500 hover:bg-green-600">Latest</Badge>
      </div>
      <div class="w-px h-4 bg-border my-auto"></div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">Status:</span>
        <Badge :variant="item?.active ? 'default' : 'secondary'">
          {{ item?.active ? 'Active' : 'Inactive' }}
        </Badge>
        <Badge v-if="item?.required" variant="destructive">Required</Badge>
      </div>
    </div>

    <!-- Stats & Content Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Main Content -->
      <div class="md:col-span-2 space-y-6">
        <!-- Release Notes -->
        <Card>
          <CardHeader>
            <CardTitle>Release Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="prose dark:prose-invert max-w-none text-sm">
              <p v-if="item?.release_notes">{{ item.release_notes }}</p>
              <p v-else class="text-muted-foreground italic">No release notes provided.</p>
            </div>
          </CardContent>
        </Card>

        <!-- Configuration Snippet -->
        <Card>
          <CardHeader>
            <CardTitle>Testing Configuration</CardTitle>
            <CardDescription>Use this configuration to test this specific version.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="bg-muted p-4 rounded-md font-mono text-xs overflow-x-auto relative group">
              <pre>{{ configSnippet }}</pre>
              <Button
                variant="ghost"
                size="icon"
                class="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                @click="copyConfig"
              >
                <ILucideCopy class="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Devices Table Section -->
        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
            <CardDescription
              >Devices associated with this {{ item?.channel }} channel.</CardDescription
            >
          </CardHeader>
          <CardContent>
            <Tabs default-value="current" class="w-full">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="current">
                  On this version ({{ currentVersionDevices.length }})
                </TabsTrigger>
                <TabsTrigger value="other">
                  Not outdated / Other ({{ otherVersionDevices.length }})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" class="mt-4">
                <div class="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device ID</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="device in currentVersionDevices" :key="device.id">
                        <TableCell class="font-mono text-xs">{{ device.device_id }}</TableCell>
                        <TableCell>{{ formatDate(device.last_check) }}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            class="text-green-600 border-green-200 bg-green-50"
                            >Updated</Badge
                          >
                        </TableCell>
                      </TableRow>
                      <TableRow v-if="currentVersionDevices.length === 0">
                        <TableCell colspan="3" class="text-center h-24 text-muted-foreground">
                          No devices currently on this version.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="other" class="mt-4">
                <div class="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device ID</TableHead>
                        <TableHead>Current Version</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="device in otherVersionDevices" :key="device.id">
                        <TableCell class="font-mono text-xs">{{ device.device_id }}</TableCell>
                        <TableCell>
                          <span v-if="getDeviceVersion(device)">{{
                            getDeviceVersion(device)
                          }}</span>
                          <span v-else class="text-muted-foreground italic">None</span>
                        </TableCell>
                        <TableCell>{{ formatDate(device.last_check) }}</TableCell>
                        <TableCell>
                          <div
                            v-if="isDeviceOutdated(device)"
                            class="flex items-center text-amber-600 text-xs font-medium"
                          >
                            <ILucideAlertTriangle class="w-3 h-3 mr-1" />
                            Outdated
                          </div>
                          <Badge v-else variant="secondary">Different Channel</Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow v-if="otherVersionDevices.length === 0">
                        <TableCell colspan="4" class="text-center h-24 text-muted-foreground">
                          No other devices found.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <!-- Sidebar Stats -->
      <div class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm font-medium text-muted-foreground">Metadata</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div v-if="item?.version_code">
              <div class="text-sm text-muted-foreground">Version Code</div>
              <div class="font-medium">{{ item.version_code }}</div>
            </div>
            <div>
              <div class="text-sm text-muted-foreground">File Size</div>
              <div class="font-medium">{{ formatFileSize(item?.file_size_bytes || 0) }}</div>
            </div>
            <div>
              <div class="text-sm text-muted-foreground">ID</div>
              <div class="font-mono text-xs mt-1 break-all">{{ item?.id }}</div>
            </div>
            <div v-if="item?.checksum">
              <div class="text-sm text-muted-foreground">Checksum (SHA)</div>
              <div class="font-mono text-xs mt-1 break-all text-muted-foreground">
                {{ item.checksum }}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-sm font-medium text-muted-foreground">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1">
                <div class="text-2xl font-bold">{{ currentVersionDevices.length }}</div>
                <div class="text-xs text-muted-foreground">Active Devices</div>
              </div>
              <div class="space-y-1">
                <div class="text-2xl font-bold">{{ adoptionRate }}%</div>
                <div class="text-xs text-muted-foreground">Adoption Rate</div>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t">
              <div class="text-xs text-muted-foreground">
                Deployed to {{ item?.channel }} devices.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Promote Dialog -->
    <UpdatesBundlesTablePromoteDialog
      v-model:promote-dialog-open="promoteDialogOpen"
      :item-id="String(item?.id)"
      @promoted="handlePromoted"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'
import UpdatesBundlesTablePromoteDialog from '@/modules/updates-bundles/components/UpdatesBundlesTable/UpdatesBundlesTablePromoteDialog.vue'

const { id: updateId } = defineProps<{
  id: string
}>()

const promoteDialogOpen = ref(false)

const route = useRoute()
const type = route.query.type as 'bundle' | 'native' | undefined

const { data: items, refetch } = useUpdatesBundlesQuery()
const { data: devices } = useDevicesQuery()

const item = computed(() => {
  return items.value?.find((i) => String(i.id) === updateId && (!type || i.type === type))
})

const isLatest = computed(() => {
  if (!item.value || !items.value) return false
  const compare = items.value.filter(
    (i) =>
      i.type === item.value?.type &&
      i.platform === item.value?.platform &&
      i.channel === item.value?.channel,
  )
  const sorted = compare.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return sorted.length > 0 && sorted[0]?.id === item.value.id
})

const relevantDevices = computed(() => {
  if (!devices.value || !item.value) return []
  return devices.value.filter(
    (d) => d.platform === item.value?.platform && (!d.channel || d.channel === item.value?.channel),
  )
})

const getDeviceVersion = (d: Device) => {
  return type === 'bundle' ? d.current_bundle_id : d.current_native_id
}

const currentVersionDevices = computed(() => {
  return relevantDevices.value.filter((d) => {
    const currentId = type === 'bundle' ? d.current_bundle_id : d.current_native_id
    return String(currentId) === String(item.value?.id)
  })
})

const otherVersionDevices = computed(() => {
  return relevantDevices.value.filter((d) => {
    const currentId = type === 'bundle' ? d.current_bundle_id : d.current_native_id
    return String(currentId) !== String(item.value?.id)
  })
})

const isDeviceOutdated = (_d: Device) => {
  console.log('isDeviceOutdated', _d)
  if (isLatest.value) return true
  return false
}

const adoptionRate = computed(() => {
  if (relevantDevices.value.length === 0) return 0
  return Math.round((currentVersionDevices.value.length / relevantDevices.value.length) * 100)
})

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Unknown date'
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return 'Unknown'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const downloadAsset = () => {
  if (item.value?.download_url) {
    window.open(item.value.download_url, '_blank')
  } else {
    toast.error('Download URL not available')
  }
}

const configSnippet = computed(() => {
  if (!item.value) return ''
  return JSON.stringify(
    {
      url: item.value.download_url,
      version: item.value.version_name,
      channel: item.value.channel,
    },
    null,
    2,
  )
})

const copyConfig = () => {
  navigator.clipboard.writeText(configSnippet.value)
  toast.success('Configuration copied to clipboard')
}

const handlePromoted = async () => {
  promoteDialogOpen.value = false
  await refetch()
}

definePage({
  meta: {
    title: 'Update Details - CapGO',
    category: 'updates-bundles',
  },
  props: true,
})
</script>
