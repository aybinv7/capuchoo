<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight">Invite your members</h1>
      <p class="text-muted-foreground">
        Collaborate with your organization members on this project.
      </p>
    </div>

    <div class="space-y-4">
      <div class="space-y-4 border rounded-lg p-4 bg-muted/20">
        <div class="grid grid-cols-[1fr,auto,auto] gap-2 items-end">
          <div class="space-y-2">
            <Label for="email">Email address</Label>
            <Input
              id="email"
              v-model="newMemberEmail"
              placeholder="colleague@example.com"
              type="email"
              @keyup.enter="addMember"
            />
          </div>
          <div class="space-y-2 w-[120px]">
            <Label>Role</Label>
            <Select v-model="newMemberRole">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="pb-0.5">
            <Button size="icon" variant="secondary" @click="addMember">
              <ILucidePlus class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="space-y-2 max-h-[200px] overflow-y-auto">
          <div
            v-for="(member, idx) in store.members"
            :key="idx"
            class="flex items-center justify-between bg-background p-3 rounded-md border text-sm"
          >
            <div class="flex items-center gap-3">
              <div class="bg-primary/10 p-1.5 rounded-full">
                <ILucideMail class="h-3 w-3 text-primary" />
              </div>
              <span>{{ member.email }}</span>
              <Badge variant="outline" class="text-xs capitalize">{{ member.role }}</Badge>
            </div>
            <Button variant="ghost" size="icon" class="h-6 w-6" @click="removeMember(idx)">
              <ILucideX class="h-3 w-3" />
            </Button>
          </div>
          <div
            v-if="store.members.length === 0"
            class="text-center py-4 text-xs text-muted-foreground dashed border rounded-md"
          >
            No members invited yet.
          </div>
        </div>
      </div>

      <div class="pt-4 flex justify-between">
        <Button variant="ghost" @click="emit('back')">Back</Button>
        <Button @click="handleFinish" :disabled="isSubmitting">
          <ILucideLoader2 v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin" />
          {{ isSubmitting ? 'Finishing...' : 'Finish Setup' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits<{
  (e: 'next'): void
  (e: 'back'): void
}>()

const store = useOnboardingStore()
const newMemberEmail = ref('')
const newMemberRole = ref<'viewer' | 'editor' | 'admin'>('viewer')
const isSubmitting = ref(false)

const addMember = () => {
  const email = newMemberEmail.value.trim()
  if (!email) return
  // Basic validation
  if (!email.includes('@')) {
    toast.error('Invalid email address')
    return
  }
  if (store.members.find((m) => m.email === email)) {
    toast.error('Member already added')
    return
  }

  store.members.push({
    email,
    role: newMemberRole.value,
  })
  newMemberEmail.value = ''
  newMemberRole.value = 'viewer'
}

const removeMember = (idx: number) => {
  store.members.splice(idx, 1)
}

const handleFinish = async () => {
  try {
    isSubmitting.value = true
    await new Promise((resolve) => setTimeout(resolve, 1500))
    toast.success('Setup complete!')
    emit('next')
  } catch (e: any) {
    toast.error(e.message || 'Failed to send invites')
  } finally {
    isSubmitting.value = false
  }
}
</script>
