<template>
  <div
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    ref="containerRef"
    class="relative"
    :class="{ 'bg-primary/10': isOver }"
  >
    <slot :isOver="isOver" />
  </div>
</template>

<script setup lang="ts">
interface DndKitDroppableProps {
  id: string
  onDrop?: (data: any, event: DragEvent) => void
  data?: any
}

const props = withDefaults(defineProps<DndKitDroppableProps>(), {
  onDrop: () => {},
})

const isOver = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

const handleDragEnter = (event: DragEvent) => {
  isOver.value = true
  event.preventDefault()
}

const handleDragLeave = (event: DragEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.relatedTarget as Node)) {
    isOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isOver.value = false

  const data = event.dataTransfer?.getData('application/json')
  const parsedData = data ? JSON.parse(data) : null

  props.onDrop(parsedData, event)
}
</script>
