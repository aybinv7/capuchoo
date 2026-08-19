<template>
  <div class="h-screen w-screen overflow-hidden bg-background">
    <CanvasWrapper />
  </div>
</template>

<script setup lang="ts">
import CanvasWrapper from '@/modules/canvas/components/CanvasWrapper.vue'
import { onMounted } from 'vue'

// Optional: Force a specific theme or cleanup on mount
onMounted(() => {
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>
