<script setup lang="ts">
import type { Data } from './interface'
import { VisTooltip } from '@unovis/vue'

interface ChartTooltip {
  x?: (d: Data, i: number) => number
  [key: string]: any
}

const props = withDefaults(defineProps<ChartTooltip>(), {
  x: (d: Data, i: number) => i,
})
</script>

<template>
  <VisTooltip v-bind="props">
    <template #default="slotProps">
      <slot v-bind="slotProps">
        {{ slotProps }}
      </slot>
    </template>
  </VisTooltip>
</template>
