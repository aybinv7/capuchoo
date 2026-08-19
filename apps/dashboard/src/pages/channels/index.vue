<template>
  <div class="space-y-6">
    <ChannelsHeader />

    <div v-if="isLoading" class="flex justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="error" class="p-6 text-center text-red-500">
      Failed to load channels: {{ error.message }}
    </div>

    <ChannelsTable
      v-else
      :items="channels || []"
      :is-loading="isFetching"
      @delete-item="handleDelete"
      @refresh="refetch"
    />
  </div>
</template>

<script setup lang="ts">
import { toast } from 'vue-sonner'

definePage({
  meta: {
    title: 'Channels - CapGO Admin',
    description: 'Manage app channels',
  },
})

const { data: channels, isLoading, isFetching, error, refetch } = useChannelsQuery()
const deleteMutation = useDeleteChannelMutation()

const handleDelete = async (id: string) => {
  try {
    await deleteMutation.mutateAsync(id)
    toast.success('Channel deleted successfully')
    refetch()
  } catch (e: any) {
    toast.error(e || 'Failed to delete channel')
  }
}
</script>
