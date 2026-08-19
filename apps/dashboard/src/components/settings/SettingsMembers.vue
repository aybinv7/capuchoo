<template>
  <div
    v-if="!activeApp"
    class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground animate-in fade-in"
  >
    <ILucideUsers class="size-12 mb-4 opacity-50" />
    <h3 class="text-lg font-medium">No app selected</h3>
    <p class="text-sm">Select an app to manage members.</p>
  </div>

  <div v-else class="max-w-3xl animate-in slide-in-from-bottom-4 duration-500">
    <!-- Header -->
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Members</h1>
        <p class="text-sm text-muted-foreground mt-1">Manage access to {{ activeApp.name }}.</p>
      </div>

      <Dialog v-model:open="isAddTeamMemberOpen">
        <DialogTrigger as-child>
          <Button size="sm" variant="default" class="gap-2">
            <ILucideUserPlus class="size-4" />
            Add Member
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription> Grant access to an organization member. </DialogDescription>
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
            <Button :loading="isAddingTeamMember" @click="addTeamMember">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Members Table -->
    <div class="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-[300px]">User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="appPermissions.length === 0">
            <TableCell colspan="3" class="text-center py-8 text-muted-foreground">
              No specific members assigned. Organization admins have implied access.
            </TableCell>
          </TableRow>

          <TableRow v-for="perm in appPermissions" :key="perm.id" class="group">
            <TableCell>
              <div class="flex items-center gap-3">
                <Avatar class="size-8 rounded-full border">
                  <AvatarImage :src="perm.users?.avatar_url ?? ''" />
                  <AvatarFallback>{{
                    getInitials(perm.users?.full_name ?? perm.users?.email ?? '?')
                  }}</AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="font-medium text-sm">{{ perm.users?.full_name || 'Unknown' }}</span>
                  <span class="text-xs text-muted-foreground">{{ perm.users?.email }}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                class="font-normal capitalize bg-muted/50 text-muted-foreground border-transparent"
              >
                {{ perm.role }}
              </Badge>
            </TableCell>
            <TableCell class="text-right">
              <Button
                variant="ghost"
                size="icon"
                class="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                @click="removeTeamMember(perm.user_id)"
              >
                <ILucideTrash2 class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { appService } from '@/services/app.service'
import { organizationService } from '@/services/organization.service'
import { useAppStore } from '@/stores/app.store'
import { toast } from 'vue-sonner'

const appStore = useAppStore()
const { activeApp } = storeToRefs(appStore)

const appPermissions = ref<any[]>([])
const orgMembers = ref<any[]>([])

// Add Team Member state
const isAddTeamMemberOpen = ref(false)
const isAddingTeamMember = ref(false)
const newTeamMember = ref({
  user_id: '',
  role: 'viewer',
})

const fetchTeamData = async () => {
  if (!activeApp.value) return
  try {
    const perms = await appService.getPermissions(activeApp.value.id)
    appPermissions.value = perms

    const members = await organizationService.getMembers(activeApp.value.organization_id)
    orgMembers.value = members
  } catch (error: any) {
    console.error('Failed to fetch team data:', error)
    toast.error(error.message || 'Failed to fetch team data')
  }
}

const addTeamMember = async () => {
  if (!newTeamMember.value.user_id || !activeApp.value) return
  isAddingTeamMember.value = true
  try {
    await appService.setPermission(
      activeApp.value.id,
      newTeamMember.value.user_id,
      newTeamMember.value.role,
    )
    toast.success('Member added')
    isAddTeamMemberOpen.value = false
    newTeamMember.value = { user_id: '', role: 'viewer' }
    await fetchTeamData()
  } catch (error: any) {
    toast.error(error?.message || 'Failed to add member')
  } finally {
    isAddingTeamMember.value = false
  }
}

const removeTeamMember = async (userId: string) => {
  if (!activeApp.value) return
  if (!confirm('Remove this member?')) return
  try {
    await appService.removePermission(activeApp.value.id, userId)
    toast.success('Member removed')
    await fetchTeamData()
  } catch (error: any) {
    toast.error(error?.message || 'Failed to remove member')
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

watch(
  activeApp,
  (newApp) => {
    if (newApp) {
      fetchTeamData()
    } else {
      appPermissions.value = []
      orgMembers.value = []
    }
  },
  { immediate: true },
)
</script>
