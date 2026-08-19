<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="transform scale-95 opacity-0"
    enter-to-class="transform scale-100 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="transform scale-100 opacity-100"
    leave-to-class="transform scale-95 opacity-0"
  >
    <div
      v-if="selectedItems.length > 0"
      class="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between"
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
          <span class="text-sm font-semibold text-primary">
            {{ selectedItems.length }}
          </span>
        </div>
        <div>
          <p class="text-sm font-medium">
            {{ selectedItems.length }} product{{ selectedItems.length > 1 ? 's' : '' }}
            selected
          </p>
          <p class="text-xs text-muted-foreground">Perform bulk actions on selected items</p>
        </div>
      </div>

      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="emit('click:bulk-edit')">
          <ILucideEdit class="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button variant="outline" size="sm" @click="emit('click:bulk-export')">
          <ILucideDownload class="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="destructive" size="sm" @click="emit('click:bulk-delete')">
          <ILucideTrash2 class="h-4 w-4 mr-2" />
          Delete
        </Button>
        <Button variant="ghost" size="sm" @click="emit('click:clear-selection')">
          <ILucideX class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const emit = defineEmits([
  'click:clear-selection',
  'click:bulk-delete',
  'click:bulk-export',
  'click:bulk-edit',
])

defineProps<{
  selectedItems: UpdateOrBundle[]
}>()
</script>

<style scoped></style>
