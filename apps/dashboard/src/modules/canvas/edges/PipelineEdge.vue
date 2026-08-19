<template>
  <BaseEdge :id="id" :path="path[0]" :style="edgeStyle" />

  <EdgeLabelRenderer>
    <div
      v-if="data?.label"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path[1]}px,${path[2]}px)`,
      }"
      class="nodrag nopan px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-tighter shadow-xl pointer-events-auto cursor-default transition-all duration-300"
      :class="labelClasses"
    >
      {{ data.label }}
    </div>
  </EdgeLabelRenderer>

  <!-- Animated Packets -->
  <g v-if="data?.state === 'deploying'">
    <circle r="4" fill="#3b82f6" class="shadow-lg">
      <animateMotion :dur="data?.duration || '1.5s'" repeatCount="indefinite" :path="path[0]" />
    </circle>
    <circle r="3" fill="#60a5fa" opacity="0.6">
      <animateMotion
        :dur="data?.duration || '1.5s'"
        begin="0.5s"
        repeatCount="indefinite"
        :path="path[0]"
      />
    </circle>
  </g>

  <g v-else-if="data?.state === 'error'">
    <circle r="4" fill="#ef4444">
      <animateMotion dur="1s" repeatCount="indefinite" :path="path[0]" />
    </circle>
  </g>
</template>

<script setup lang="ts">
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@vue-flow/core'
import { computed } from 'vue'

const props = defineProps<
  EdgeProps<{
    state?: 'idle' | 'deploying' | 'success' | 'error'
    duration?: string
    label?: string
  }>
>()

const path = computed(() => getSmoothStepPath(props))

const edgeStyle = computed(() => {
  switch (props.data?.state) {
    case 'deploying':
      return { stroke: '#3b82f6', strokeWidth: 3, strokeDasharray: '5, 5' }
    case 'error':
      return { stroke: '#ef4444', strokeWidth: 2 }
    default:
      return { stroke: '#94a3b8', strokeWidth: 1.5 }
  }
})

const labelClasses = computed(() => {
  switch (props.data?.state) {
    case 'deploying':
      return 'bg-blue-600 text-white border-blue-400 animate-pulse'
    case 'error':
      return 'bg-red-600 text-white border-red-400'
    case 'success':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    default:
      return 'bg-background/80 text-muted-foreground border-muted'
  }
})
</script>
