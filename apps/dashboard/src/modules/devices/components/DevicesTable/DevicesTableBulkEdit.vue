<template>
  <Transition
    enter-active-class="transition ease-out duration-100"
    enter-from-class="transform opacity-0 scale-95"
    enter-to-class="transform opacity-100 scale-100"
    leave-active-class="transition ease-in duration-75"
    leave-from-class="transform opacity-100 scale-100"
    leave-to-class="transform opacity-0 scale-95"
  >
    <div v-if="selectedCount > 0" class="flex items-center gap-2 p-4 bg-muted rounded-lg border">
      <div class="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-md border">
        <span class="relative flex h-2 w-2">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/75 opacity-75"
          ></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        <span class="text-sm font-medium">
          {{ selectedCount }} {{ selectedCount === 1 ? 'item' : 'items' }} selected
        </span>
      </div>

      <div class="h-6 w-px bg-border mx-2"></div>

      <Button size="sm" variant="ghost" @click="$emit('click:clear-selection')">
        <X class="w-4 h-4 mr-2" />
        Clear
      </Button>
      <Button size="sm" variant="secondary" @click="$emit('click:bulk-edit')">
        <Pencil class="w-4 h-4 mr-2" />
        Edit
      </Button>
      <Button size="sm" variant="destructive" @click="$emit('click:bulk-delete')">
        <Trash2 class="w-4 h-4 mr-2" />
        Delete
      </Button>
      <Button size="sm" variant="outline" @click="$emit('click:bulk-export')">
        <Download class="w-4 h-4 mr-2" />
        Export
      </Button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { X, Pencil, Trash2, Download } from 'lucide-vue-next'
import type { Device } from '../../types/devices.types'

interface Props {
  selectedItems: Device[]
}

const props = defineProps<Props>()

const selectedCount = computed(() => props.selectedItems.length)

defineEmits<{
  (e: 'click:clear-selection'): void
  (e: 'click:bulk-edit'): void
  (e: 'click:bulk-delete'): void
  (e: 'click:bulk-export'): void
}>()

import { computed } from 'vue'
</script>
