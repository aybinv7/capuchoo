<template>
  <div
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    :class="cssClasses"
    :style="style"
  >
    <slot :attributes="attributes" :listeners="listeners" :isDragging="isDragging" />
  </div>
</template>

<script setup lang="ts">
interface DndKitDraggableProps {
  id: string
  data?: any
  disabled?: boolean
}

const props = defineProps<DndKitDraggableProps>()

// Drag state
const isDragging = ref(false)

const handleDragStart = (event: DragEvent) => {
  if (props.disabled) return
  isDragging.value = true
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', props.id)
    event.dataTransfer.setData('application/json', JSON.stringify(props.data || {}))
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragEnd = () => {
  isDragging.value = false
}

const style = computed(() => ({
  zIndex: isDragging.value ? 1000 : undefined,
  touchAction: 'none',
}))

const cssClasses = computed(() => ({
  'opacity-50': isDragging.value,
  'cursor-move': !props.disabled,
  'cursor-not-allowed': props.disabled,
}))

const attributes = {
  draggable: !props.disabled,
}

const listeners = {
  dragstart: handleDragStart,
  dragend: handleDragEnd,
}
</script>
