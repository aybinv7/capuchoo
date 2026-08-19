<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" @click="router.back()">
            <ArrowLeft class="h-4 w-4" />
          </Button>
          <div class="flex items-center gap-3">
            <div
              v-if="app?.icon_url"
              class="h-12 w-12 rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg"
            >
              <img :src="app.icon_url" :alt="app.name" class="h-full w-full object-cover" />
            </div>
            <div
              v-else
              class="h-12 w-12 rounded-xl bg-linear-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20"
            >
              <AppWindow class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 class="text-2xl font-bold tracking-tight">{{ app?.name || 'Loading...' }}</h1>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <code class="bg-muted px-2 py-0.5 rounded text-xs">{{ app?.app_id }}</code>
                <Badge v-if="app?.platform" variant="secondary" class="text-xs">
                  {{ app.platform }}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="router.push(`/apps/${id}/edit`)">
          <Settings class="mr-2 h-4 w-4" />
          Configure
        </Button>
        <Button variant="destructive" size="sm" @click="handleDelete" :disabled="isDeleting">
          <Trash2 class="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="app">
      <Tabs default-value="overview" class="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" class="space-y-6">
          <!-- Stats Grid -->
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card class="overflow-hidden">
              <div class="h-1 bg-linear-to-r from-blue-500 to-blue-600" />
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Total Devices</CardTitle>
                <Smartphone class="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div class="text-3xl font-bold">{{ app.total_devices ?? 0 }}</div>
                <p class="text-xs text-muted-foreground mt-1">Active installations</p>
              </CardContent>
            </Card>
            <Card class="overflow-hidden">
              <div class="h-1 bg-linear-to-r from-emerald-500 to-emerald-600" />
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Bundles</CardTitle>
                <Package class="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div class="text-3xl font-bold">{{ app.total_bundles ?? 0 }}</div>
                <p class="text-xs text-muted-foreground mt-1">OTA updates uploaded</p>
              </CardContent>
            </Card>
            <Card class="overflow-hidden">
              <div class="h-1 bg-linear-to-r from-violet-500 to-violet-600" />
              <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">Channels</CardTitle>
                <Radio class="h-4 w-4 text-violet-500" />
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
                <Clock class="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div class="text-xl font-bold">{{ formatDate(app.created_at) }}</div>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ formatRelativeTime(app.created_at) }}
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
                    <Code class="h-5 w-5" />
                    SDK Configuration
                  </CardTitle>
                  <CardDescription>
                    Copy these settings to your <code>capacitor.config.ts</code> file to enable OTA
                    updates for this app.
                  </CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div
                    class="rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-50 relative group"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      class="absolute right-2 top-2 h-8 w-8 text-zinc-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      @click="copySnippet"
                    >
                      <Copy class="h-4 w-4" />
                    </Button>
                    <pre class="overflow-x-auto"><code>{{ sdkSnippet }}</code></pre>
                  </div>
                  <Alert>
                    <Info class="h-4 w-4" />
                    <AlertDescription>
                      Ensure you have the <code>@capgo/capacitor-updater</code> plugin installed in
                      your project.
                    </AlertDescription>
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
                    @click="router.push(`/channels?app_id=${app.id}`)"
                  >
                    <Radio class="mr-2 h-4 w-4" />
                    Manage Channels
                  </Button>
                  <Button
                    class="w-full justify-start"
                    variant="outline"
                    @click="router.push(`/updates-bundles?app_id=${app.app_id}`)"
                  >
                    <Package class="mr-2 h-4 w-4" />
                    Manage Bundles
                  </Button>
                  <Button
                    class="w-full justify-start"
                    variant="outline"
                    @click="router.push(`/devices?app_id=${app.app_id}`)"
                  >
                    <Smartphone class="mr-2 h-4 w-4" />
                    View Devices
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-7">
              <div>
                <CardTitle class="text-2xl font-heading">App Team</CardTitle>
                <CardDescription>
                  Manage which organization members have direct access to this specific app. Note:
                  Org Admins and Owners always have full access.
                </CardDescription>
              </div>
              <Dialog v-model:open="isAddTeamMemberOpen">
                <DialogTrigger as-child>
                  <Button size="sm">
                    <UserPlus class="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Select an organization member to grant them access to this app.
                    </DialogDescription>
                  </DialogHeader>
                  <div class="space-y-4 py-4">
                    <div class="space-y-2">
                      <Label>Member</Label>
                      <Select v-model="newTeamMember.user_id">
                        <SelectTrigger>
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="m in orgMembers" :key="m.user_id" :value="m.user_id">
                            {{ m.users?.full_name || m.users?.email }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div class="space-y-2">
                      <Label>Role</Label>
                      <Select v-model="newTeamMember.role">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="tester">Tester</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" @click="isAddTeamMemberOpen = false">Cancel</Button>
                    <Button :loading="isAddingTeamMember" @click="addTeamMember">Add Member</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div class="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead class="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="perm in appPermissions" :key="perm.id">
                      <TableCell>
                        <div class="flex items-center gap-3">
                          <Avatar class="h-8 w-8">
                            <AvatarImage :src="perm.users?.avatar_url" />
                            <AvatarFallback>{{
                              getInitials(perm.users?.full_name || perm.users?.email || '?')
                            }}</AvatarFallback>
                          </Avatar>
                          <div class="flex flex-col">
                            <span class="font-medium text-sm">{{
                              perm.users?.full_name || 'No Name'
                            }}</span>
                            <span class="text-xs text-muted-foreground">{{
                              perm.users?.email
                            }}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" class="capitalize">{{ perm.role }}</Badge>
                      </TableCell>
                      <TableCell class="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          class="text-destructive hover:text-destructive hover:bg-destructive/10"
                          @click="removeTeamMember(perm.user_id)"
                        >
                          <UserMinus class="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Update your app metadata.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <div class="grid gap-4 max-w-2xl">
                <div class="space-y-2">
                  <Label for="app_name">App Name</Label>
                  <Input id="app_name" v-model="editForm.name" />
                </div>
                <div class="space-y-2">
                  <Label for="app_bundle_id">App ID / Bundle ID</Label>
                  <Input
                    id="app_bundle_id"
                    v-model="editForm.app_id"
                    disabled
                    class="font-mono bg-muted"
                  />
                </div>
                <div class="space-y-2">
                  <Label for="app_icon">Icon URL</Label>
                  <Input id="app_icon" v-model="editForm.icon_url" placeholder="https://..." />
                </div>
                <div class="space-y-2">
                  <Label>Platform</Label>
                  <Select v-model="editForm.platform">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="ios">iOS Only</SelectItem>
                      <SelectItem value="android">Android Only</SelectItem>
                      <SelectItem value="web">Web Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardHeader class="border-t">
              <div class="flex justify-end">
                <Button :loading="isSavingSettings" @click="saveSettings"> Save Settings </Button>
              </div>
            </CardHeader>
          </Card>

          <Card class="mt-6 border-destructive/20 bg-destructive/5 text-destructive-foreground">
            <CardHeader>
              <CardTitle class="text-destructive">Danger Zone</CardTitle>
              <CardDescription class="text-destructive/80"
                >Permanent actions for this app.</CardDescription
              >
            </CardHeader>
            <CardContent>
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="font-semibold text-destructive">Delete this App</h4>
                  <p class="text-sm text-destructive/80">
                    Once deleted, all data and history will be lost forever.
                  </p>
                </div>
                <Button variant="destructive" @click="handleDelete" :disabled="isDeleting">
                  Delete App
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>

    <div
      v-else
      class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"
    >
      <AlertCircle class="h-12 w-12 mb-4" />
      <h3 class="text-lg font-semibold">App not found</h3>
      <p class="mb-4">The requested app could not be found.</p>
      <Button @click="router.push('/apps')">Back to Apps</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ArrowLeft,
  Loader2,
  Settings,
  Trash2,
  AppWindow,
  Smartphone,
  Package,
  Radio,
  Clock,
  Copy,
  Info,
  Code,
  UserPlus,
  UserMinus,
} from 'lucide-vue-next'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const { showSuccess, showError } = useToast()

const { data: app, isLoading } = useAppQuery(props.id)
const deleteMutation = useDeleteAppMutation()

const isDeleting = ref(false)
const appPermissions = ref<any[]>([])
const orgMembers = ref<any[]>([])

// Add Team Member state
const isAddTeamMemberOpen = ref(false)
const isAddingTeamMember = ref(false)
const newTeamMember = ref({
  user_id: '',
  role: 'viewer',
})

// Settings state
const isSavingSettings = ref(false)
const editForm = ref({
  name: '',
  app_id: '',
  icon_url: '',
  platform: 'all' as any,
  config: {} as any,
})

// Update form when app data loads
watch(
  app,
  (newApp) => {
    if (newApp) {
      editForm.value = {
        name: newApp.name,
        app_id: newApp.app_id,
        icon_url: newApp.icon_url || '',
        platform: newApp.platform || 'all',
        config: newApp.config || {},
      }
      fetchTeamData()
    }
  },
  { immediate: true },
)

const fetchTeamData = async () => {
  if (!app.value) return
  try {
    const perms = await appService.getPermissions(app.value.id)
    appPermissions.value = perms

    const members = await organizationService.getMembers(app.value.organization_id)
    orgMembers.value = members
  } catch {
    console.error('Failed to fetch team data:')
  }
}

const addTeamMember = async () => {
  if (!newTeamMember.value.user_id) return
  isAddingTeamMember.value = true
  try {
    if (!app.value?.id) return
    await appService.setPermission(
      app.value.id,
      newTeamMember.value.user_id,
      newTeamMember.value.role,
    )
    showSuccess('Team member added')
    isAddTeamMemberOpen.value = false
    newTeamMember.value = { user_id: '', role: 'viewer' }
    await fetchTeamData()
  } catch {
    showError('Failed to add team member')
  } finally {
    isAddingTeamMember.value = true
  }
}

const removeTeamMember = async (userId: string) => {
  if (!confirm('Are you sure you want to remove this member from the app team?')) return
  try {
    if (!app.value?.id) return

    await appService.removePermission(app.value?.id, userId)
    showSuccess('Member removed from team')
    await fetchTeamData()
  } catch {
    showError('Failed to remove member')
  }
}

const saveSettings = async () => {
  isSavingSettings.value = true
  try {
    if (!app.value?.id) return
    await appService.update(app.value.id, editForm.value)
    showSuccess('Settings saved successfully')
    // We might need to refresh the app query here
  } catch {
    showError('Failed to save settings')
  } finally {
    isSavingSettings.value = false
  }
}

const channelCount = computed(() => 0) // TODO: Fetch from API

const sdkSnippet = computed(() => {
  const apiBase = window.location.origin.replace(/:\d+$/, ':3000') + '/api'
  return `import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${app.value?.app_id || 'com.example.app'}',
  appName: '${app.value?.name || 'My App'}',
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
    showSuccess('Configuration snippet copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
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

const handleDelete = async () => {
  if (!confirm('Are you sure you want to delete this app? This action cannot be undone.')) return

  isDeleting.value = true
  try {
    await deleteMutation.mutateAsync(props.id)
    router.push('/apps')
  } catch {
    console.error('Failed to delete app')
  } finally {
    isDeleting.value = false
  }
}

definePage({
  meta: {
    title: 'App Details - setup',
    category: 'apps',
  },
  props: true,
})
</script>
