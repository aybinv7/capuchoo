<template>
  <div
    v-if="!activeApp"
    class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in"
  >
    <ILucideAppWindow class="size-12 mb-4 opacity-50" />
    <h3 class="text-lg font-medium">No app selected</h3>
    <p class="text-sm">Select an app to view its settings.</p>
  </div>

  <div v-else class="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-2">
        <img
          v-if="activeApp.icon_url"
          :src="activeApp.icon_url"
          class="size-8 rounded-md object-cover border"
        />
        <div
          v-else
          class="size-8 rounded-md bg-primary/10 flex items-center justify-center text-primary"
        >
          <ILucideAppWindow class="size-5" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ activeApp.name }}</h1>
      </div>
      <p class="text-sm text-muted-foreground">General settings and configuration.</p>
    </div>

    <!-- General Settings -->
    <section class="mb-10">
      <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
        General
      </h2>

      <form @submit.prevent="updateApp" class="space-y-5">
        <div class="grid gap-1.5">
          <Label for="name" class="text-xs uppercase text-muted-foreground">App Name</Label>
          <Input
            id="name"
            v-model="form.name"
            class="bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
          />
        </div>

        <div class="grid gap-1.5">
          <Label for="app_id" class="text-xs uppercase text-muted-foreground">Bundle ID</Label>
          <div class="flex items-center gap-2">
            <Input
              id="app_id"
              v-model="form.app_id"
              disabled
              class="bg-muted/50 text-muted-foreground font-mono text-sm cursor-not-allowed"
            />
            <ILucideLock class="size-4 text-muted-foreground/50" />
          </div>
        </div>

        <div class="grid gap-1.5">
          <Label for="icon_url" class="text-xs uppercase text-muted-foreground">Icon URL</Label>
          <div class="flex gap-3">
            <Input
              id="icon_url"
              v-model="form.icon_url"
              placeholder="https://..."
              class="bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
            />
          </div>
        </div>

        <div class="grid gap-1.5">
          <Label for="platform" class="text-xs uppercase text-muted-foreground">Platform</Label>
          <Select v-model="form.platform">
            <SelectTrigger
              class="bg-muted/30 border-transparent focus:bg-background focus:border-input transition-all"
            >
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ios">iOS</SelectItem>
              <SelectItem value="android">Android</SelectItem>
              <SelectItem value="all">All Platforms</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="pt-2">
          <Button type="submit" :disabled="isLoading" variant="default" size="sm">
            Save Changes
          </Button>
        </div>
      </form>
    </section>

    <Separator class="my-10" />

    <!-- Danger Zone -->
    <section>
      <h2 class="text-sm font-medium text-destructive uppercase tracking-wider mb-4">
        Danger Zone
      </h2>

      <div
        class="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between"
      >
        <div class="space-y-1">
          <h4 class="font-medium text-sm text-destructive">Delete this App</h4>
          <p class="text-xs text-muted-foreground">Permanently delete all data and history.</p>
        </div>
        <Button variant="destructive" size="sm" @click="handleDeleteApp" :disabled="isDeleting">
          {{ isDeleting ? 'Deleting...' : 'Delete App' }}
        </Button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { appService } from '@/services/app.service'
import { useAppStore } from '@/stores/app.store'
import { useDeleteAppMutation } from '@/modules/apps/composables/useAppsQuery'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { Separator } from '@/components/ui/separator'

const router = useRouter()
const appStore = useAppStore()
const { activeApp } = storeToRefs(appStore)
const deleteMutation = useDeleteAppMutation()
const queryClient = useQueryClient()

const isLoading = ref(false)
const isDeleting = ref(false)

const form = ref({
  name: '',
  app_id: '',
  icon_url: '',
  platform: 'all' as any,
})

// Initialize form
watch(
  activeApp,
  (newApp) => {
    if (newApp) {
      form.value = {
        name: newApp.name,
        app_id: newApp.app_id,
        icon_url: newApp.icon_url || '',
        platform: newApp.platform || 'all',
      }
    }
  },
  { immediate: true },
)

const updateApp = async () => {
  if (!activeApp.value) return
  isLoading.value = true
  try {
    const updatedApp = await appService.update(activeApp.value.id, {
      name: form.value.name,
      icon_url: form.value.icon_url,
      app_id: form.value.app_id, // Usually backend ignores this if immutable
      organization_id: activeApp.value.organization_id,
      platform: form.value.platform,
    })

    // Update local state immediately for snappy feel
    appStore.setActiveApp(updatedApp)
    await queryClient.invalidateQueries({ queryKey: ['apps'] })
    toast.success('App updated successfully')
  } catch (error: any) {
    toast.error(error.message || 'Failed to update app')
  } finally {
    isLoading.value = false
  }
}

const handleDeleteApp = async () => {
  if (!activeApp.value) return
  if (!confirm('Are you sure you want to delete this app? This is irreversible.')) return

  isDeleting.value = true
  try {
    await deleteMutation.mutateAsync(activeApp.value.id)
    await queryClient.invalidateQueries({ queryKey: ['apps'] })
    appStore.setActiveApp(null)
    toast.success('App deleted')
    router.push('/dashboard')
  } catch (error: any) {
    toast.error(error.message || 'Failed to delete app')
  } finally {
    isDeleting.value = false
  }
}
</script>
