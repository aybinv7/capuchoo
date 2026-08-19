<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogDescription>
          <p v-if="!itemToDelete">
            Are you sure you want to delete {{ selectedItems.length }} selected channels? This
            action cannot be undone.
          </p>
          <p v-else>Are you sure you want to delete this channel? This action cannot be undone.</p>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button variant="outline" @click="dialogOpen = false">Cancel</Button>
        <Button
          variant="destructive"
          :disabled="isDeleting"
          @click="$emit('click:handle-delete-confirm')"
        >
          <span v-if="isDeleting">Deleting...</span>
          <span v-else>Delete</span>
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
import { Button } from '@/components/ui/button'
import type { Channel } from '../../types/channels.types'

interface Props {
  deleteDialogOpen: boolean
  itemToDelete: string | null
  selectedItems: Channel[]
  isDeleting: boolean
}

interface Emits {
  (e: 'update:deleteDialogOpen', value: boolean): void
  (e: 'click:handle-delete-confirm'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogOpen = computed({
  get: () => props.deleteDialogOpen,
  set: (value) => emit('update:deleteDialogOpen', value),
})
</script>
