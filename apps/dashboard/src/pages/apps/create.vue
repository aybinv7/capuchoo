<template>
  <div class="w-full space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl font-heading font-bold">Create App</h1>
        <p class="text-muted-foreground">Register a new application</p>
      </div>
    </div>

    <!-- Create Form -->
    <div class="flex flex-col justify-center items-center gap-6 w-full">
      <Card class="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>App Details</CardTitle>
          <CardDescription>Enter your application information</CardDescription>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Organization -->
            <div class="space-y-2">
              <Label for="organization">Organization</Label>
              <Select v-model="form.organization_id" :disabled="isLoading || isLoadingOrgs">
                <SelectTrigger>
                  <SelectValue
                    :placeholder="isLoadingOrgs ? 'Loading...' : 'Select organization'"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="org in organizations" :key="org.id" :value="org.id">
                    {{ org.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- App Name -->
            <div class="space-y-2">
              <Label for="name">App Name</Label>
              <Input id="name" v-model="form.name" placeholder="My App" :disabled="isLoading" />
            </div>

            <!-- App ID -->
            <div class="space-y-2">
              <Label for="app_id">App ID (Bundle Identifier)</Label>
              <Input
                id="app_id"
                v-model="form.app_id"
                placeholder="com.example.myapp"
                :disabled="isLoading"
              />
              <p class="text-xs text-muted-foreground">
                Use your app's bundle identifier (e.g., com.company.appname)
              </p>
            </div>

            <!-- Platform -->
            <div class="space-y-2">
              <Label for="platform">Platform</Label>
              <Select v-model="form.platform" :disabled="isLoading">
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="all">All Platforms</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Icon URL (optional) -->
            <div class="space-y-2">
              <Label for="icon_url">Icon URL (optional)</Label>
              <Input
                id="icon_url"
                v-model="form.icon_url"
                placeholder="https://example.com/icon.png"
                :disabled="isLoading"
              />
            </div>

            <!-- Error Display -->
            <div v-if="error" class="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {{ error }}
            </div>

            <!-- Submit -->
            <div class="flex gap-3">
              <Button type="button" variant="outline" @click="router.back()" :disabled="isLoading">
                Cancel
              </Button>
              <Button type="submit" :disabled="isLoading || !isValid">
                <ILucideLoader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
                Create App
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCreateAppMutation } from '@/modules/apps/composables/useAppsQuery'
import { useOrganizationsQuery } from '@/modules/organizations/composables/useOrganizationsQuery'
import { useAppStore } from '@/stores/app.store'
import { useQueryClient } from '@tanstack/vue-query'

definePage({
  meta: {
    title: 'Create App - CapGO Updater',
    description: 'Register a new application',
    category: 'apps',
  },
})

const form = ref({
  organization_id: '',
  name: '',
  app_id: '',
  platform: 'all' as 'ios' | 'android' | 'all',
  icon_url: '',
})

const router = useRouter()
const queryClient = useQueryClient()
const appStore = useAppStore()

const { data: organizations, isLoading: isLoadingOrgs } = useOrganizationsQuery()

const error = ref<string | null>(null)
const isLoading = ref(false)

const isValid = computed(() => {
  return (
    form.value.organization_id.length > 0 &&
    form.value.name.length > 0 &&
    form.value.app_id.length > 0
  )
})

const createMutation = useCreateAppMutation()

const handleSubmit = async () => {
  if (!isValid.value) return

  error.value = null
  isLoading.value = true

  try {
    const newApp = await createMutation.mutateAsync({
      organization_id: form.value.organization_id,
      name: form.value.name,
      app_id: form.value.app_id,
      platform: form.value.platform,
      icon_url: form.value.icon_url || undefined,
    })

    // Invalidate apps query to refetch
    await queryClient.invalidateQueries({ queryKey: ['apps'] })

    // Set as active app
    appStore.setActiveApp(newApp)

    // Navigate to dashboard
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.message || 'Failed to create app'
  } finally {
    isLoading.value = false
  }
}
</script>
