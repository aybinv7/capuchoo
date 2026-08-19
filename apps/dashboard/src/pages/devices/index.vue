<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-heading font-bold">Devices</h1>
        <p class="text-muted-foreground">View and manage registered devices.</p>
      </div>
      <div class="flex items-center gap-2 bg-muted p-1 rounded-md">
        <Button
          variant="ghost"
          size="sm"
          :class="{ 'bg-background shadow-sm': viewMode === 'list' }"
          @click="viewMode = 'list'"
        >
          <LayoutList class="h-4 w-4 mr-2" />
          List
        </Button>
        <Button
          variant="ghost"
          size="sm"
          :class="{ 'bg-background shadow-sm': viewMode === 'map' }"
          @click="viewMode = 'map'"
        >
          <MapIcon class="h-4 w-4 mr-2" />
          Map
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <div v-else-if="error" class="p-6 text-center text-red-500">
      Failed to load devices: {{ error.message }}
    </div>

    <div v-else>
      <Transition name="fade" mode="out-in">
        <DevicesTable
          v-if="viewMode === 'list'"
          :items="devices || []"
          :is-loading="isFetching"
          @delete-item="handleDelete"
          @update-channel="handleUpdateChannel"
          @refresh="refetch"
        />
        <DevicesMap v-else :items="devices || []" />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import DevicesMap from '@/modules/devices/components/DevicesMap.vue'
import { toast } from 'vue-sonner'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { LayoutList, Map as MapIcon } from 'lucide-vue-next'

definePage({
  meta: {
    title: 'Devices - CapGO Admin',
    description: 'Manage app devices',
  },
})

const { data: devices, isLoading, isFetching, error, refetch } = useDevicesQuery()
const deleteMutation = useDeleteDeviceMutation()
const updateChannelMutation = useUpdateDeviceChannelMutation()

const viewMode = ref<'list' | 'map'>('list')

const handleDelete = async (id: string) => {
  try {
    await deleteMutation.mutateAsync(id)
    toast.success('Device deleted successfully')
    refetch()
  } catch (e: any) {
    toast.error(e || 'Failed to delete device')
  }
}

const handleUpdateChannel = async (id: string, channel: string) => {
  try {
    await updateChannelMutation.mutateAsync({ id, channel })
    toast.success('Device channel updated successfully')
    refetch()
  } catch (e: any) {
    toast.error(e || 'Failed to update device channel')
  }
}
</script>
