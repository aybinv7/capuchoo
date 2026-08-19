<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Update Device Channel</DialogTitle>
        <DialogDescription>
          Assign a new channel to device {{ device?.device_id }}.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label>Channel</Label>
          <Select v-model="selectedChannel">
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prod">Prod</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="dev">Dev</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="dialogOpen = false">Cancel</Button>
        <Button :disabled="isUpdating || !selectedChannel" @click="handleUpdate">
          <span v-if="isUpdating">Updating...</span>
          <span v-else>Update</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Device } from '../../types/devices.types'
import { ref, watch } from 'vue'

interface Props {
  open: boolean
  device: Device | null
  isUpdating: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'update', deviceId: string, channel: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedChannel = ref('')

const dialogOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

watch(
  () => props.device,
  (newDevice) => {
    if (newDevice) {
      selectedChannel.value = newDevice.channel || 'prod'
    }
  },
)

const handleUpdate = () => {
  if (props.device && selectedChannel.value) {
    emit('update', props.device.id, selectedChannel.value)
  }
}
</script>
