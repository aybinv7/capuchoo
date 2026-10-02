<script setup lang="ts">
import { GitCompareArrows, Package, X } from "@lucide/vue";

const props = defineProps<{ version: string; behind: boolean }>();
const emit = defineEmits<{ clearVersion: []; clearBehind: [] }>();
</script>

<template>
  <div v-if="props.version || props.behind" class="flex flex-wrap items-center gap-2">
    <span
      v-if="props.behind"
      class="bg-warning/10 text-warning border-warning/30 inline-flex h-7 items-center gap-1.5 rounded-md border pr-1 pl-2 text-xs"
    >
      <GitCompareArrows class="size-3.5" aria-hidden="true" />
      Behind their channel
      <button
        type="button"
        class="hover:bg-warning/15 rounded p-0.5"
        aria-label="Show every device, not only those behind"
        @click="emit('clearBehind')"
      >
        <X class="size-3" />
      </button>
    </span>
    <span
      v-if="props.version"
      class="bg-muted inline-flex h-7 items-center gap-1.5 rounded-md border pr-1 pl-2 text-xs"
    >
      <Package class="text-muted-foreground size-3.5" aria-hidden="true" />
      <span class="text-muted-foreground">Version</span>
      <span class="font-mono">{{ props.version }}</span>
      <button
        type="button"
        class="hover:bg-accent rounded p-0.5"
        aria-label="Show every version"
        @click="emit('clearVersion')"
      >
        <X class="size-3" />
      </button>
    </span>
  </div>
</template>
