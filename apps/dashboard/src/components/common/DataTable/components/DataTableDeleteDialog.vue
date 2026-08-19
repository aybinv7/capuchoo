<template>
  <Dialog :open="open" @update:open="(val) => $emit('update:open', val)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title || 'Are you absolutely sure?' }}</DialogTitle>
        <DialogDescription>
          {{
            description ||
            'This action cannot be undone. This will permanently delete the selected items.'
          }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="$emit('cancel')">Cancel</Button>
        <Button variant="destructive" @click="$emit('confirm')"> Delete </Button>
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

defineProps<{
  open: boolean
  title?: string
  description?: string
}>()

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'update:open', value: boolean): void
}>()
</script>
