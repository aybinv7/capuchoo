<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent :class="className">
      <DialogHeader>
        <DialogTitle>{{ title || 'Bulk Edit' }}</DialogTitle>
        <DialogDescription>
          {{ description || `Edit properties for ${selectedCount} selected items` }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <!-- Default slot for custom form fields -->
        <slot></slot>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button type="submit" @click="$emit('confirm')">Save changes</Button>
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
  selectedCount?: number
  className?: string
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}>()
</script>
