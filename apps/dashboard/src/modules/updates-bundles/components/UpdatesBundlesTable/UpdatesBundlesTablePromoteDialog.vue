<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Promote Version</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="target-channel">Target Channel</Label>
          <Select v-model="targetChannel" :disabled="!targetAppId || isLoadingChannels">
            <SelectTrigger id="target-channel">
              <SelectValue
                :placeholder="isLoadingChannels ? 'Loading channels...' : 'Select a channel'"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="channel in channels" :key="channel.id" :value="channel.name">
                {{ channel.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2 pt-2">
          <Label for="password">Confirm with Password</Label>
          <Input v-model="password" type="password" placeholder="Enter your password" />
          <p class="text-[10px] text-muted-foreground">
            For security, please verify your password before promoting versions.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="dialogOpen = false">Cancel</Button>
        <Button
          :disabled="!targetAppId || !targetChannel || !password || isPromoting"
          @click="handlePromote"
        >
          <ILucideZap v-if="!isPromoting" class="w-4 h-4 mr-2" />
          <span v-if="isPromoting">Promoting...</span>
          <span v-else>Promote</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

interface Props {
  promoteDialogOpen: boolean
  itemId: string | null
}

interface Emits {
  (e: 'update:promoteDialogOpen', value: boolean): void
  (e: 'promoted', data: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const appStore = useAppStore()
const targetAppId = ref('')
const targetChannel = ref('')
const password = ref('')
const isPromoting = ref(false)

onMounted(() => {
  if (appStore.activeApp) {
    targetAppId.value = appStore.activeApp.app_id
  }
})

watch(
  () => appStore.activeApp,
  (newApp) => {
    if (newApp) {
      targetAppId.value = newApp.app_id
    }
  },
)

const dialogOpen = computed({
  get: () => props.promoteDialogOpen,
  set: (value) => emit('update:promoteDialogOpen', value),
})

const channels = ref<any[]>([])
const isLoadingChannels = ref(false)

watch(targetAppId, async (newAppId) => {
  if (newAppId) {
    isLoadingChannels.value = true
    try {
      const response = await apiClient.get(`/dashboard/channels?app_id=${newAppId}`)
      channels.value = response.data
    } catch (error) {
      console.error('Failed to fetch channels', error)
      toast.error('Failed to load channels for the selected application.')
    } finally {
      isLoadingChannels.value = false
    }
  } else {
    channels.value = []
  }
  targetChannel.value = ''
})

const handlePromote = async () => {
  if (!props.itemId || !targetAppId.value || !targetChannel.value) return

  isPromoting.value = true
  try {
    const response = await apiClient.post(`/dashboard/bundles/${props.itemId}/promote`, {
      target_app_id: targetAppId.value,
      target_channel: targetChannel.value,
      password: password.value,
    })

    toast.success('Item promoted successfully.')

    emit('promoted', response.data)
    dialogOpen.value = false
  } catch (error: any) {
    console.error('Promotion failed', error)
    const message = error.response?.data?.error || 'Could not promote the item.'
    toast.error(message)
  } finally {
    isPromoting.value = false
  }
}
</script>
