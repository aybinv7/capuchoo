<script setup lang="ts">
import { Copy } from "@lucide/vue";

const props = defineProps<{ name: string; value: string }>();
const emit = defineEmits<{ copy: [] }>();
</script>

<template>
  <button
    type="button"
    class="group/chip bg-surface hover:bg-accent focus-visible:ring-ring/50 relative inline-flex h-6 max-w-64 min-w-0 cursor-copy items-center gap-1.5 overflow-hidden rounded-md border px-2 text-xs transition-colors outline-none focus-visible:ring-3"
    :title="`${props.name}: ${props.value}`"
    :aria-label="`Copy ${props.name}: ${props.value}`"
    @click="emit('copy')"
  >
    <span class="text-muted-foreground shrink-0">{{ props.name }}</span>
    <span class="text-foreground truncate font-mono">{{ props.value }}</span>
    <span
      class="from-accent via-accent pointer-events-none absolute inset-y-0 right-0 flex items-center bg-linear-to-l to-transparent pr-1.5 pl-4 opacity-0 transition-opacity group-hover/chip:opacity-100 group-focus-visible/chip:opacity-100"
      aria-hidden="true"
    >
      <Copy class="text-foreground size-3" />
    </span>
  </button>
</template>
