<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="space-y-2 text-center">
      <h1 class="text-3xl font-bold tracking-tight">Configure Channels</h1>
      <p class="text-muted-foreground">Set up the deployment channels for your app.</p>
    </div>

    <div class="space-y-4">
      <div class="space-y-4 border rounded-lg p-4 bg-muted/20">
        <label class="text-sm font-medium">Add Channel</label>
        <div class="flex gap-2">
          <Input v-model="newChannel" placeholder="e.g. Staging" @keyup.enter="addChannel" />
          <Button size="icon" variant="secondary" @click="addChannel">
            <ILucidePlus class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-2 max-h-[200px] overflow-y-auto pr-2">
          <div
            v-for="(channel, idx) in store.channels"
            :key="idx"
            class="flex items-center justify-between bg-background p-3 rounded-md border text-sm animate-in zoom-in-95 duration-200"
          >
            <div class="flex items-center gap-3">
              <ILucideRadio class="h-4 w-4 text-muted-foreground" />
              <span class="font-medium">{{ channel }}</span>
            </div>

            <Button
              v-if="channel !== 'Production'"
              variant="ghost"
              size="icon"
              class="h-6 w-6 text-muted-foreground hover:text-destructive"
              @click="removeChannel(idx)"
            >
              <ILucideX class="h-3 w-3" />
            </Button>
            <Badge v-else variant="outline" class="text-xs">Default</Badge>
          </div>
        </div>
      </div>

      <div class="pt-4 flex justify-between">
        <Button variant="ghost" @click="emit('back')">Back</Button>
        <Button @click="emit('next')">
          Next
          <ILucideArrowRight class="ml-2 h-4 w-4" />
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
const newChannel = ref('')

onMounted(() => {
  if (!store.channels.includes('Production')) {
    store.channels.unshift('Production')
  }
})

const addChannel = () => {
  const val = newChannel.value.trim()
  if (!val) return
  if (store.channels.includes(val)) {
    toast.error('Channel already exists')
    return
  }
  store.channels.push(val)
  newChannel.value = ''
}

const removeChannel = (idx: number) => {
  if (store.channels[idx] === 'Production') return
  store.channels.splice(idx, 1)
}
</script>
