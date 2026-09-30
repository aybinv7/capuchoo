<script setup lang="ts">
import { computed } from "vue";
import { formatPercent, ratio } from "../lib/format";

const props = defineProps<{ onCurrent: number; devices: number }>();

const value = computed(() => ratio(props.onCurrent, props.devices));
const width = computed(() => `${Math.round((value.value ?? 0) * 100)}%`);
</script>

<template>
  <div
    class="flex items-center gap-2"
    :title="`${props.onCurrent} of ${props.devices} devices run the current bundle`"
  >
    <div
      class="bg-muted relative h-1.5 w-full min-w-12 overflow-hidden rounded-full"
      role="meter"
      :aria-valuenow="Math.round((value ?? 0) * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Adoption of the current bundle"
    >
      <div
        class="bg-success absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
        :style="{ width }"
      />
    </div>
    <span class="text-muted-foreground w-11 shrink-0 text-right font-mono text-[11px] tabular">
      {{ formatPercent(value) }}
    </span>
  </div>
</template>
