<template>
  <Transition
    enter-active-class="transition ease-out duration-100"
    enter-from-class="transform opacity-0 scale-95"
    enter-to-class="transform opacity-100 scale-100"
    leave-active-class="transition ease-in duration-75"
    leave-from-class="transform opacity-100 scale-100"
    leave-to-class="transform opacity-0 scale-95"
  >
    <div v-if="selectedCount > 0" class="flex items-center gap-2 p-4 bg-muted rounded-lg">
      <span class="text-sm font-medium">
        {{ selectedCount }} {{ selectedCount === 1 ? 'item' : 'items' }} selected
      </span>
      <Button size="sm" variant="secondary" @click="$emit('click:clear-selection')"> Clear </Button>
      <Button v-if="enableEdit" size="sm" variant="secondary" @click="$emit('click:bulk-edit')">
        Edit
      </Button>
      <Button
        v-if="enableDelete"
        size="sm"
        variant="destructive"
        @click="$emit('click:bulk-delete')"
      >
        Delete
      </Button>
      <Button v-if="enableExport" size="sm" variant="outline" @click="$emit('click:bulk-export')">
        Export
      </Button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{
  selectedCount: number
  enableEdit?: boolean
  enableDelete?: boolean
  enableExport?: boolean
}>()

defineEmits<{
  'click:bulk-edit': []
  'click:bulk-delete': []
  'click:bulk-export': []
  'click:clear-selection': []
}>()
</script>
