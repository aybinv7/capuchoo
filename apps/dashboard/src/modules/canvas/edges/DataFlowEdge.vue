<template>
  <BaseEdge :id="id" :path="path[0]" :style="style" />

  <Circle v-if="data?.animated" :r="3" fill="#3b82f6">
    <animateMotion :dur="data?.duration || '2s'" repeatCount="indefinite" :path="path[0]" />
  </Circle>

  <EdgeLabelRenderer>
    <div
      v-if="data?.label"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path[1]}px,${path[2]}px)`,
      }"
      class="nodrag nopan bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full border text-[10px] font-medium shadow-sm pointer-events-auto cursor-default"
    >
      {{ data.label }}
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<
  EdgeProps<{
    animated?: boolean
    duration?: string
    label?: string
  }>
>()

const path = computed(() => getSmoothStepPath(props))
</script>
