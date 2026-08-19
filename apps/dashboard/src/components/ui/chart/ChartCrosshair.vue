<script setup lang="ts">
import { VisCrosshair } from '@unovis/vue'

interface ChartCrosshairProps {
  [key: string]: any
}

const props = defineProps<ChartCrosshairProps>()
</script>

<template>
  <VisCrosshair v-bind="props">
    <template #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </VisCrosshair>
</template>
