<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div data-slot="table-container" class="relative w-full h-full overflow-auto">
    <table data-slot="table" :class="cn('w-full caption-bottom text-sm h-full  ', props.class)">
      <slot />
    </table>
  </div>
</template>
