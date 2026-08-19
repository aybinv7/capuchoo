<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="router.back()">
          <ILucideArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-3xl font-bold tracking-tight capitalize">
              {{ channel?.name || 'Channel' }}
            </h1>
            <Badge variant="outline">Channel</Badge>
          </div>
          <p class="text-muted-foreground font-mono text-xs mt-1">{{ channel?.id }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Dialog v-model:open="isDeleteDialogOpen">
          <DialogTrigger as-child>
            <Button variant="destructive" outline size="sm">
              <ILucideTrash2 class="mr-2 h-4 w-4" />
              Delete Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Channel</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the channel <strong>{{ channel?.name }}</strong
                >? This action cannot be undone and will affect all devices assigned to this
                channel.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2 sm:gap-0">
              <Button variant="outline" @click="isDeleteDialogOpen = false"> Cancel </Button>
              <Button variant="destructive" @click="confirmDelete" :disabled="isDeleting">
                <ILucideLoader2 v-if="isDeleting" class="mr-2 h-4 w-4 animate-spin" />
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-12">
      <ILucideLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      <p class="text-sm text-muted-foreground mt-2">Loading channel details...</p>
    </div>

    <div v-else-if="error" class="p-8 text-center border rounded-lg bg-destructive/5">
      <ILucideAlertCircle class="h-10 w-10 text-destructive mx-auto mb-4" />
      <h3 class="text-lg font-semibold text-destructive">Failed to load channel</h3>
      <p class="text-muted-foreground">{{ error.message }}</p>
      <Button variant="outline" class="mt-4" @click="router.back()"> Go Back </Button>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column: Settings & History -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Settings Card -->
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription> Configure channel behavior and rollout rules. </CardDescription>
          </CardHeader>
          <CardContent>
            <form @submit.prevent="handleUpdate" class="space-y-6">
              <div class="space-y-2">
                <Label for="name">Channel Name</Label>
                <Input id="name" v-model="editForm.name" />
                <p class="text-xs text-muted-foreground">
                  The identifier used by the SDK (e.g. "prod")
                </p>
              </div>

              <div class="space-y-2">
                <Label for="environment">Environment</Label>
                <Select v-model="editForm.environment">
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prod">Prod</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="dev">Dev</SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">
                  The CLI will use the corresponding .env file when deploying to this channel.
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div
                  class="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/30"
                >
                  <div class="space-y-0.5">
                    <Label class="text-base">iOS Support</Label>
                    <p class="text-xs text-muted-foreground">Enabled for Apple devices</p>
                  </div>
                  <Switch v-model="editForm.ios_enabled" />
                </div>
                <div
                  class="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-muted/30"
                >
                  <div class="space-y-0.5">
                    <Label class="text-base">Android Support</Label>
                    <p class="text-xs text-muted-foreground">Enabled for Android devices</p>
                  </div>
                  <Switch v-model="editForm.android_enabled" />
                </div>
              </div>

              <Separator />

              <div class="space-y-4">
                <h4 class="text-sm font-medium">Auto-Update Rules</h4>

                <div class="flex items-center justify-between space-x-2 p-1">
                  <div class="space-y-0.5">
                    <Label>Public Visibility</Label>
                    <p class="text-xs text-muted-foreground">
                      Whether this channel is visible to all users/devices
                    </p>
                  </div>
                  <Switch v-model="editForm.is_public" />
                </div>

                <div class="flex items-center justify-between space-x-2 p-1">
                  <div class="space-y-0.5">
                    <Label>Allow Self-Set</Label>
                    <p class="text-xs text-muted-foreground">
                      Allow devices to switch themselves to this channel via SDK
                    </p>
                  </div>
                  <Switch v-model="editForm.allow_device_self_set" />
                </div>

                <div class="flex items-center justify-between space-x-2 p-1">
                  <div class="space-y-0.5">
                    <Label>Allow Emulators</Label>
                    <p class="text-xs text-muted-foreground">
                      Allow updates on simulators and emulators
                    </p>
                  </div>
                  <Switch v-model="editForm.allow_emulator" />
                </div>

                <div class="flex items-center justify-between space-x-2 p-1">
                  <div class="space-y-0.5">
                    <Label>Allow Development Builds</Label>
                    <p class="text-xs text-muted-foreground">
                      Allow updates on debug-mode application builds
                    </p>
                  </div>
                  <Switch v-model="editForm.allow_dev" />
                </div>

                <Separator />

                <div class="space-y-4 pt-2">
                  <h4 class="text-sm font-medium">Auto-Update Constraints</h4>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                      <Label>Disable Auto-Update</Label>
                      <Select v-model="editForm.disable_auto_update">
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Always update)</SelectItem>
                          <SelectItem value="major">Major (Stop on X.0.0)</SelectItem>
                          <SelectItem value="minor">Minor (Stop on 0.X.0)</SelectItem>
                          <SelectItem value="patch">Patch (Stop on 0.0.X)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p class="text-[10px] text-muted-foreground">
                        Control when the SDK should stop automatic updates based on semver.
                      </p>
                    </div>

                    <div class="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                      <div class="space-y-0.5">
                        <Label>Under Native</Label>
                        <p class="text-[10px] text-muted-foreground">
                          Disable OTA if native version changed
                        </p>
                      </div>
                      <Switch v-model="editForm.disable_auto_update_under_native" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div class="space-y-4 pt-2">
                  <h4 class="text-sm font-medium">Active Deployment</h4>
                  <div class="space-y-2">
                    <Label>Current Version</Label>
                    <Select v-model="editForm.current_version_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none"> None (No active deployment) </SelectItem>
                        <SelectItem
                          v-for="update in channelBundles"
                          :key="update.id"
                          :value="update.id"
                        >
                          v{{ update.version_name }} ({{ update.platform }})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p class="text-[10px] text-muted-foreground">
                      This bundle is currently served to all devices on this channel.
                    </p>
                  </div>

                  <div class="space-y-2 pt-2">
                    <Label>Current Native Version</Label>
                    <Select v-model="editForm.current_native_version_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Select native version" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none"> None (No active native deployment) </SelectItem>
                        <SelectItem
                          v-for="update in channelNativeUpdates"
                          :key="update.id"
                          :value="update.id"
                        >
                          v{{ update.version_name }} ({{ update.platform }} - Code:
                          {{ update.version_code }})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p class="text-[10px] text-muted-foreground">
                      This native binary is forced as the minimum required version.
                    </p>
                  </div>
                </div>

                <div class="pt-4 flex justify-end gap-3">
                  <Button type="submit" :disabled="isUpdating">
                    <ILucideLoader2 v-if="isUpdating" class="mr-2 h-4 w-4 animate-spin" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <!-- Recent Updates History -->
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription
              >History of releases currently available on this channel.</CardDescription
            >
          </CardHeader>
          <CardContent>
            <div class="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Constraint</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead class="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="update in recentUpdates" :key="update.id">
                    <TableCell class="font-medium">
                      <div class="flex items-center gap-2">
                        <Badge variant="secondary" class="font-mono"
                          >v{{ update.version_name }}</Badge
                        >
                        <span
                          v-if="update.type === 'native'"
                          class="text-[10px] uppercase font-bold text-primary"
                          >Native</span
                        >
                      </div>
                    </TableCell>
                    <TableCell class="capitalize">
                      <div class="flex items-center gap-2">
                        <ILucideSmartphone
                          v-if="update.platform === 'android' || update.platform === 'ios'"
                          class="h-3 w-3"
                        />
                        <ILucideGlobe v-else class="h-3 w-3" />
                        {{ update.platform }}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        v-if="update.required"
                        variant="destructive"
                        class="text-[10px] scale-90"
                      >
                        REQUIRED
                      </Badge>
                      <span v-else class="text-[10px] text-muted-foreground ml-2">Optional</span>
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">{{
                      formatDate(update.created_at)
                    }}</TableCell>
                    <TableCell>
                      <div class="flex items-center gap-2">
                        <Badge
                          :variant="update.active ? 'default' : 'secondary'"
                          class="text-[10px]"
                        >
                          {{ update.active ? 'LIVE' : 'INACTIVE' }}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell class="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        @click="router.push(`/updates-bundles/${update.id}?type=${update.type}`)"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="recentUpdates.length === 0">
                    <TableCell colspan="5" class="text-center h-24 text-muted-foreground">
                      No updates match this channel yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Right Column: Info, Stats & Code -->
      <div class="space-y-6">
        <!-- Stats Overview -->
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="flex items-center gap-4">
              <div class="p-2 bg-primary/10 rounded-full">
                <ILucideSmartphone class="h-4 w-4 text-primary" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-muted-foreground leading-none">Devices</p>
                <p class="text-xl font-bold mt-1">{{ channelDevices.length }}</p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <div class="p-2 bg-primary/10 rounded-full">
                <ILucidePackage class="h-4 w-4 text-primary" />
              </div>
              <div class="flex-1">
                <p class="text-xs text-muted-foreground leading-none">Total Updates</p>
                <p class="text-xl font-bold mt-1">{{ channelBundles.length }}</p>
              </div>
            </div>
            <Separator />
            <div class="space-y-1">
              <p class="text-xs text-muted-foreground">Latest Release</p>
              <p class="font-medium">{{ latestVersion || 'No versions' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- SDK Configuration Snippet -->
        <Card class="overflow-hidden">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">SDK Implementation</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <div
              class="bg-zinc-950 p-4 rounded-lg font-mono text-[10px] text-zinc-300 relative group border border-white/5"
            >
              <pre class="overflow-x-auto"><code>{{ configSnippet }}</code></pre>
              <Button
                variant="ghost"
                size="icon"
                class="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                @click="copyConfig"
              >
                <ILucideCopy class="h-3 w-3" />
              </Button>
            </div>
            <p class="text-[10px] text-muted-foreground italic">
              Copy this to your capacitor.config.ts
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  useChannelQuery,
  useUpdateChannelMutation,
  useDeleteChannelMutation,
} from '@/modules/channels/composables/useChannelsQuery'
import { useUpdatesBundlesQuery } from '@/modules/updates-bundles/composables/useUpdatesBundlesQuery'
import { useDevicesQuery } from '@/modules/devices/composables/useDevicesQuery'

const route = useRoute()
const router = useRouter()
const channelId = computed(() => (route.params as any).id as string)

// Data queries
const { data: channel, isLoading, error } = useChannelQuery(channelId)
const { data: updates } = useUpdatesBundlesQuery()
const { data: devices } = useDevicesQuery()

// Mutations
const { mutateAsync: updateChannel, isPending: isUpdating } = useUpdateChannelMutation()
const { mutateAsync: deleteChannel, isPending: isDeleting } = useDeleteChannelMutation()

// Local state
const isDeleteDialogOpen = ref(false)
const editForm = ref({
  name: '',
  environment: 'staging' as 'prod' | 'staging' | 'dev',
  ios_enabled: true,
  android_enabled: true,
  is_public: false,
  allow_device_self_set: false,
  allow_emulator: true,
  allow_dev: true,
  disable_auto_update: 'none' as 'none' | 'major' | 'minor' | 'patch',
  disable_auto_update_under_native: false,
  current_version_id: 'none',
  current_native_version_id: 'none',
})

// Analytics logic
const channelBundles = computed(() => {
  // Show all available OTA bundles for this app, they are not channel-specific until assigned
  return updates.value?.filter((u: any) => u.type === 'bundle') || []
})

const channelNativeUpdates = computed(() => {
  // Show all available Native updates for this app
  return updates.value?.filter((u: any) => u.type === 'native') || []
})

const channelDevices = computed(() => {
  return devices.value?.filter((d) => d.channel === channel.value?.name) || []
})

const recentUpdates = computed(() => {
  return [...channelBundles.value, ...channelNativeUpdates.value]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
})

const latestVersion = computed(() => {
  if (recentUpdates.value.length === 0) return null
  return recentUpdates.value[0]?.version_name
})

const configSnippet = computed(() => {
  return `// capacitor.config.ts
{
  plugins: {
    CapacitorUpdater: {
      appId: "${channel.value?.app_id || 'YOUR_APP_ID'}",
      channel: "${channel.value?.name || 'prod'}",
      autoUpdate: true
    }
  }
}`
})

// Initialize form when data is loaded
watch(
  channel,
  (newChannel) => {
    if (newChannel) {
      editForm.value = {
        name: newChannel.name,
        environment: newChannel.environment || 'staging',
        ios_enabled: newChannel.ios_enabled ?? true,
        android_enabled: newChannel.android_enabled ?? true,
        is_public: newChannel.is_public ?? false,
        allow_device_self_set: newChannel.allow_device_self_set ?? false,
        allow_emulator: newChannel.allow_emulator ?? true,
        allow_dev: newChannel.allow_dev ?? true,
        disable_auto_update: newChannel.disable_auto_update || 'none',
        disable_auto_update_under_native: newChannel.disable_auto_update_under_native ?? false,
        current_version_id: newChannel.current_version_id || 'none',
        current_native_version_id: newChannel.current_native_version_id || 'none',
      }
    }
  },
  { immediate: true },
)

const handleUpdate = async () => {
  try {
    const payload = { ...editForm.value }
    if (payload.current_version_id === 'none') {
      payload.current_version_id = null as any
    }
    if (payload.current_native_version_id === 'none') {
      payload.current_native_version_id = null as any
    }

    await updateChannel({
      id: channelId.value,
      data: payload,
    })
    toast.success('Channel updated successfully')
  } catch (error: any) {
    toast.error(error.message || 'Failed to update channel')
  }
}

const confirmDelete = async () => {
  try {
    await deleteChannel(channelId.value)
    toast.success('Channel deleted successfully')
    isDeleteDialogOpen.value = false
    router.push('/channels')
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete channel')
  }
}

const copyConfig = () => {
  navigator.clipboard.writeText(configSnippet.value)
  toast.success('Config copied to clipboard')
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

definePage({
  meta: {
    title: 'Channel Details - CapGO',
    category: 'channels',
  },
  props: true,
})
</script>
