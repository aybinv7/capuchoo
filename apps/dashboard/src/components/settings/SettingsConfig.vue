<template>
  <div
    v-if="!activeApp"
    class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in"
  >
    <h3 class="text-lg font-medium">No app selected</h3>
    <p class="text-sm">Select an app to view its configuration.</p>
  </div>

  <div v-else class="max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
    <!-- Environment Variables Section -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-xl font-semibold tracking-tight text-foreground">
            Environment Variables
          </h2>
          <p class="text-sm text-muted-foreground">
            Configure key-value pairs per environment and channel.
            <span class="text-amber-500">(Demo: stored in localStorage)</span>
          </p>
        </div>
        <div class="flex gap-2">
          <Button size="sm" @click="showAddForm = !showAddForm">
            <ILucidePlus class="size-4 mr-2" />
            Add Variable
          </Button>
        </div>
      </div>
    </div>

    <!-- Environment Tabs -->
    <Tabs v-model="activeEnvironment" class="w-full">
      <TabsList class="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="all">All Envs</TabsTrigger>
        <TabsTrigger value="production">Production</TabsTrigger>
        <TabsTrigger value="staging">Staging</TabsTrigger>
        <TabsTrigger value="development">Development</TabsTrigger>
      </TabsList>

      <!-- Channel Filter -->
      <div class="flex items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg border">
        <ILucideFilter class="size-4 text-muted-foreground" />
        <span class="text-sm text-muted-foreground">Channel:</span>
        <div class="flex gap-1 flex-wrap">
          <Button
            v-for="ch in availableChannels"
            :key="ch.value"
            :variant="activeChannel === ch.value ? 'default' : 'outline'"
            size="sm"
            class="h-7 text-xs"
            @click="activeChannel = ch.value"
          >
            {{ ch.label }}
            <Badge
              v-if="getChannelVarCount(ch.value) > 0"
              variant="secondary"
              class="ml-1 h-4 px-1 text-[10px]"
            >
              {{ getChannelVarCount(ch.value) }}
            </Badge>
          </Button>
        </div>
      </div>

      <!-- Add Form (inline) -->
      <div v-if="showAddForm" class="mb-4 p-4 border rounded-lg bg-muted/30 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label class="text-xs uppercase text-muted-foreground">Key</Label>
            <Input
              v-model="newVar.key"
              placeholder="API_URL"
              class="font-mono"
              @keyup.enter="addVariable"
            />
          </div>
          <div class="space-y-2">
            <Label class="text-xs uppercase text-muted-foreground">Value</Label>
            <Input
              v-model="newVar.value"
              placeholder="https://api.example.com"
              :type="newVar.is_secret ? 'password' : 'text'"
              @keyup.enter="addVariable"
            />
          </div>
        </div>
        <div class="grid grid-cols-4 gap-4">
          <div class="space-y-2">
            <Label class="text-xs uppercase text-muted-foreground">Type</Label>
            <Select v-model="newVar.value_type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label class="text-xs uppercase text-muted-foreground">Environment</Label>
            <Select v-model="newVar.environment">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label class="text-xs uppercase text-muted-foreground">Channel</Label>
            <Select v-model="newVar.channel">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Channels</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
                <SelectItem value="prod">prod</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex items-end gap-4">
            <div class="flex items-center gap-2">
              <Checkbox v-model:checked="newVar.is_secret" id="is-secret" />
              <Label for="is-secret" class="text-sm">Secret</Label>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" @click="showAddForm = false">Cancel</Button>
          <Button size="sm" @click="addVariable" :disabled="!newVar.key"> Add Variable </Button>
        </div>
      </div>

      <!-- Variables Table -->
      <div class="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-1/5">Key</TableHead>
              <TableHead class="w-1/4">Value</TableHead>
              <TableHead class="w-16">Type</TableHead>
              <TableHead class="w-24">Environment</TableHead>
              <TableHead class="w-24">Channel</TableHead>
              <TableHead class="w-16 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="filteredVars.length === 0">
              <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
                <ILucideDatabase class="size-8 mx-auto mb-2 opacity-50" />
                <p>No environment variables for this filter</p>
                <p class="text-xs">Add variables or change the environment/channel filter</p>
              </TableCell>
            </TableRow>
            <TableRow v-for="envVar in filteredVars" :key="envVar.id" class="group">
              <TableCell class="font-mono text-sm font-medium text-primary">
                {{ envVar.key }}
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <code
                    v-if="envVar.is_secret && !revealedSecrets[envVar.id]"
                    class="text-xs text-muted-foreground"
                  >
                    ••••••••
                  </code>
                  <code
                    v-else
                    class="text-xs bg-muted px-1.5 py-0.5 rounded max-w-40 truncate block"
                  >
                    {{ envVar.value }}
                  </code>
                  <Button
                    v-if="envVar.is_secret"
                    variant="ghost"
                    size="icon"
                    class="size-6 opacity-0 group-hover:opacity-100"
                    @click="toggleReveal(envVar.id)"
                  >
                    <ILucideEye v-if="!revealedSecrets[envVar.id]" class="size-3" />
                    <ILucideEyeOff v-else class="size-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" class="text-[10px]">{{ envVar.value_type }}</Badge>
              </TableCell>
              <TableCell>
                <Badge
                  :variant="envVar.environment === 'production' ? 'default' : 'outline'"
                  class="text-[10px] capitalize"
                >
                  {{ envVar.environment }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  v-if="envVar.channel"
                  variant="outline"
                  class="text-[10px] border-primary/50 text-primary"
                >
                  {{ envVar.channel }}
                </Badge>
                <span v-else class="text-xs text-muted-foreground">All</span>
              </TableCell>
              <TableCell class="text-right">
                <div
                  class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Button variant="ghost" size="icon" class="size-7" @click="startEdit(envVar)">
                    <ILucidePencil class="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 text-destructive hover:text-destructive"
                    @click="deleteVariable(envVar.id)"
                  >
                    <ILucideTrash2 class="size-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div class="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
        <p class="text-xs text-amber-600 dark:text-amber-400">
          <ILucideInfo class="size-3 inline mr-1" />
          <strong>Demo Mode:</strong> Variables are stored in localStorage for demonstration
          purposes. This data is not persisted to any backend.
        </p>
      </div>
    </Tabs>

    <!-- Edit Dialog -->
    <Dialog v-model:open="showEditDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Variable</DialogTitle>
        </DialogHeader>
        <div class="space-y-4" v-if="editingVar">
          <div class="space-y-2">
            <Label>Value</Label>
            <Input v-model="editingVar.value" class="font-mono" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Type</Label>
              <Select v-model="editingVar.value_type">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Environment</Label>
              <Select v-model="editingVar.environment">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Channel</Label>
            <Select v-model="editingVar.channel">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Channels</SelectItem>
                <SelectItem value="staging">staging</SelectItem>
                <SelectItem value="prod">prod</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">Cancel</Button>
          <Button @click="saveEdit">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores/app.store'
import { storeToRefs } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { toast } from 'vue-sonner'

interface EnvVar {
  id: string
  key: string
  value: string
  value_type: 'string' | 'number' | 'boolean' | 'json'
  environment: 'production' | 'staging' | 'development' | 'all'
  channel?: string
  is_secret: boolean
}

const appStore = useAppStore()
const { activeApp } = storeToRefs(appStore)

// State
const activeEnvironment = ref<string>('all')
const activeChannel = ref<string>('')
const showAddForm = ref(false)
const showEditDialog = ref(false)
const editingVar = ref<EnvVar | null>(null)
const revealedSecrets = ref<Record<string, boolean>>({})

// localStorage-based storage with vueuse
const envVars = useLocalStorage<EnvVar[]>('capucho-demo-env-vars', [])

const newVar = ref({
  key: '',
  value: '',
  value_type: 'string' as const,
  environment: 'production' as const,
  channel: '',
  is_secret: false,
})

const availableChannels = computed(() => [
  { label: 'All Channels', value: '' },
  { label: 'staging', value: 'staging' },
  { label: 'prod', value: 'prod' },
  { label: 'dev', value: 'dev' },
])

const getChannelVarCount = (channelValue: string) => {
  return envVars.value.filter((v) => {
    const matchesEnv =
      activeEnvironment.value === 'all' ||
      v.environment === activeEnvironment.value ||
      v.environment === 'all'
    const matchesChannel = channelValue === '' ? !v.channel : v.channel === channelValue
    return matchesEnv && matchesChannel
  }).length
}

const filteredVars = computed(() => {
  return envVars.value
    .filter((v) => {
      const matchesEnv =
        activeEnvironment.value === 'all' ||
        v.environment === activeEnvironment.value ||
        v.environment === 'all'
      const matchesChannel =
        activeChannel.value === '' ? true : !v.channel || v.channel === activeChannel.value
      return matchesEnv && matchesChannel
    })
    .sort((a, b) => {
      if (!a.channel && b.channel) return -1
      if (a.channel && !b.channel) return 1
      return a.key.localeCompare(b.key)
    })
})

// Actions
const addVariable = () => {
  if (!newVar.value.key) return

  const variable: EnvVar = {
    id: crypto.randomUUID(),
    key: newVar.value.key,
    value: newVar.value.value,
    value_type: newVar.value.value_type,
    environment: newVar.value.environment,
    channel: newVar.value.channel || undefined,
    is_secret: newVar.value.is_secret,
  }

  envVars.value = [...envVars.value, variable]
  toast.success(`Added ${newVar.value.key}`)

  newVar.value = {
    key: '',
    value: '',
    value_type: 'string',
    environment: 'production',
    channel: '',
    is_secret: false,
  }
  showAddForm.value = false
}

const startEdit = (envVar: EnvVar) => {
  editingVar.value = { ...envVar }
  showEditDialog.value = true
}

const saveEdit = () => {
  if (!editingVar.value?.id) return

  const idx = envVars.value.findIndex((v) => v.id === editingVar.value!.id)
  if (idx !== -1) {
    const updated = [...envVars.value]
    updated[idx] = editingVar.value
    envVars.value = updated
    toast.success('Variable updated')
  }
  showEditDialog.value = false
}

const deleteVariable = (id: string) => {
  envVars.value = envVars.value.filter((v) => v.id !== id)
  toast.success('Variable deleted')
}

const toggleReveal = (id: string) => {
  revealedSecrets.value[id] = !revealedSecrets.value[id]
}
</script>
