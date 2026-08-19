<template>
  <div class="space-y-6 max-w-2xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="router.back()">
        <ILucideArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Create Channel</h1>
        <p class="text-muted-foreground">Add a new deployment channel to your app</p>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Channel Details</CardTitle>
        <CardDescription>
          Channels help you manage different environments or rollout stages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Channel Name</Label>
            <Input
              id="name"
              v-model="formData.name"
              placeholder="e.g. prod, staging, dev"
              required
            />
            <p class="text-xs text-muted-foreground">
              This name is used by the client to identify the channel.
            </p>
          </div>

          <div class="space-y-2">
            <Label>Platform Support</Label>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center space-x-2 border p-3 rounded-lg">
                <Switch id="ios" v-model="formData.ios_enabled" />
                <Label for="ios" class="flex-1 cursor-pointer">iOS Enabled</Label>
              </div>
              <div class="flex items-center space-x-2 border p-3 rounded-lg">
                <Switch id="android" v-model="formData.android_enabled" />
                <Label for="android" class="flex-1 cursor-pointer">Android Enabled</Label>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="environment">Environment</Label>
            <Select v-model="formData.environment">
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

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <Label for="is_public">Public Channel</Label>
              <Switch id="is_public" v-model="formData.is_public" />
            </div>
            <p class="text-xs text-muted-foreground">
              Public channels allow devices to self-assign if permitted.
            </p>
          </div>

          <div class="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" @click="router.back()"> Cancel </Button>
            <Button type="submit" :disabled="isPending">
              <ILucideLoader2 v-if="isPending" class="mr-2 h-4 w-4 animate-spin" />
              Create Channel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useCreateChannelMutation } from '@/modules/channels/composables/useChannelsQuery'
import { useAppStore } from '@/stores/app.store'

definePage({
  meta: {
    title: 'Create Channel - CapGO',
    category: 'channels',
  },
})

const router = useRouter()
const appStore = useAppStore()
const { mutateAsync: createChannel, isPending } = useCreateChannelMutation()

const formData = ref({
  name: '',
  environment: 'staging' as const,
  ios_enabled: true,
  android_enabled: true,
  is_public: false,
})

const handleSubmit = async () => {
  if (!appStore.activeApp?.app_id) {
    toast.error('No active app selected')
    return
  }

  try {
    const res = await createChannel({
      ...formData.value,
      app_id: appStore.activeApp.app_id,
    })
    toast.success('Channel created successfully')
    router.push(`/channels/${res.id}`)
  } catch (error: any) {
    toast.error(error.message || 'Failed to create channel')
  }
}
</script>
