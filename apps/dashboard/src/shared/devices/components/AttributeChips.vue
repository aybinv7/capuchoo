<script setup lang="ts">
import { computed } from "vue";
import { attributeChips, attributesText } from "../lib/device-attributes";
import type { DeviceAttributes } from "@capuchoo/core";

const props = withDefaults(
  defineProps<{ attributes: DeviceAttributes | null | undefined; limit?: number }>(),
  { limit: 2 },
);

const view = computed(() => attributeChips(props.attributes, props.limit));
const all = computed(() => attributesText(props.attributes));
</script>

<template>
  <span v-if="view.chips.length" class="flex min-w-0 items-center gap-1" :title="all">
    <span
      v-for="chip in view.chips"
      :key="chip.key"
      class="bg-surface inline-flex max-w-40 min-w-0 items-baseline gap-1 rounded border px-1.5 py-px text-[11px]"
    >
      <span class="text-muted-foreground shrink-0">{{ chip.key }}</span>
      <span class="truncate font-medium">{{ chip.value }}</span>
    </span>
    <span
      v-if="view.hidden"
      class="text-muted-foreground shrink-0 font-mono text-[10px] tabular"
      :aria-label="`${view.hidden} more attributes`"
      >+{{ view.hidden }}</span
    >
  </span>
  <span v-else class="text-muted-foreground text-xs">—</span>
</template>
