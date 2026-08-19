<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-semibold tracking-tight">API Keys</h2>
      <p class="text-muted-foreground">
        Manage API keys for CLI access.
        <span v-if="activeApp" class="font-medium text-primary">
          Scoped to: {{ activeApp.name }}
        </span>
        <span v-else class="text-destructive font-medium"> No active app selected! </span>
      </p>
    </div>

    <Separator />

    <!-- Create Key -->
    <Card>
      <CardHeader>
        <CardTitle class="text-lg">Create New API Key</CardTitle>
        <CardDescription> Generate an API key to use with the Capucho CLI. </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex gap-4">
          <Input
            v-model="newKeyName"
            placeholder="Key name (e.g. 'My Laptop')"
            class="max-w-xs"
            :disabled="!activeApp"
          />
          <Button @click="createKey" :disabled="isCreating || !activeApp">
            <ILucidePlus v-if="!isCreating" class="mr-2 h-4 w-4" />
            <ILucideLoader2 v-else class="mr-2 h-4 w-4 animate-spin" />
            {{ isCreating ? 'Creating...' : 'Generate Key' }}
          </Button>
        </div>
        <p v-if="!activeApp" class="text-sm text-destructive font-medium">
          Please select an app from the sidebar to manage API keys.
        </p>

        <!-- New Key Display -->
        <Alert v-if="newlyCreatedKey" variant="default" class="border-green-500 bg-green-500/10">
          <ILucideCheck class="h-4 w-4 text-green-500" />
          <AlertTitle class="text-green-600">Key Created Successfully!</AlertTitle>
          <AlertDescription class="space-y-3">
            <p class="text-sm">Copy this key now. You won't be able to see it again.</p>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm break-all">
                {{ newlyCreatedKey }}
              </code>
              <Button variant="outline" size="sm" @click="copyKey">
                <ILucideCopy class="h-4 w-4" />
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              Run: <code class="bg-muted px-1 rounded">capucho-cli auth login</code> and paste this
              key
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>

    <!-- Existing Keys -->
    <Card>
      <CardHeader>
        <CardTitle class="text-lg">Your API Keys</CardTitle>
        <CardDescription> Active API keys for CLI authentication. </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <ILucideLoader2 class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="keys.length === 0" class="text-center py-8 text-muted-foreground">
          <ILucideKey class="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>No API keys yet. Create one above to get started.</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="key in keys"
            :key="key.id"
            class="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
          >
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <ILucideKey class="h-4 w-4 text-muted-foreground" />
                <span class="font-medium">{{ key.name }}</span>
              </div>
              <div class="text-sm text-muted-foreground">
                <code class="bg-muted px-1 rounded">{{ key.key_prefix }}...</code>
                · Created {{ formatDate(key.created_at) }}
                <span v-if="key.last_used_at">
                  · Last used {{ formatDate(key.last_used_at) }}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              class="text-destructive hover:text-destructive hover:bg-destructive/10"
              @click="revokeKey(key.id)"
              :disabled="revokingId === key.id"
            >
              <ILucideTrash2 v-if="revokingId !== key.id" class="h-4 w-4" />
              <ILucideLoader2 v-else class="h-4 w-4 animate-spin" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { apiClient } from '@/services/api.client'
import { useAppStore } from '@/stores/app.store'
import { toast } from 'vue-sonner'

const appStore = useAppStore()
const { activeApp } = storeToRefs(appStore)

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

const keys = ref<ApiKey[]>([])
const isLoading = ref(true)
const isCreating = ref(false)
const revokingId = ref<string | null>(null)
const newKeyName = ref('')
const newlyCreatedKey = ref<string | null>(null)

const fetchKeys = async () => {
  try {
    isLoading.value = true
    const response = await apiClient.get('/api-keys', {
      params: { app_id: activeApp.value?.id },
    })
    keys.value = response.data.keys || []
  } catch (error) {
    console.error('Failed to fetch API keys:', error)
  } finally {
    isLoading.value = false
  }
}

const createKey = async () => {
  if (!activeApp.value) return

  try {
    isCreating.value = true
    newlyCreatedKey.value = null

    const response = await apiClient.post('/api-keys', {
      name: newKeyName.value || 'CLI Key',
      app_id: activeApp.value.id,
    })

    newlyCreatedKey.value = response.data.key
    newKeyName.value = ''
    toast.success('API key created!')

    // Refresh the list
    await fetchKeys()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Failed to create API key')
  } finally {
    isCreating.value = false
  }
}

const copyKey = async () => {
  if (newlyCreatedKey.value) {
    await navigator.clipboard.writeText(newlyCreatedKey.value)
    toast.success('Key copied to clipboard!')
  }
}

const revokeKey = async (id: string) => {
  try {
    revokingId.value = id
    await apiClient.delete(`/api-keys/${id}`)
    toast.success('API key revoked')
    await fetchKeys()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Failed to revoke API key')
  } finally {
    revokingId.value = null
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

watch(activeApp, () => {
  fetchKeys()
})

onMounted(fetchKeys)
</script>
