<script setup lang="ts">
import { computed } from "vue";
import { formatBytes } from "@/shared/lib/format";
import type { PerfLaneEntry } from "../../types/recordings.types";

const props = defineProps<{ entries: readonly PerfLaneEntry[] }>();

const tiles = computed(() => {
  const longtasks = props.entries.filter((entry) => entry.kind === "longtask");
  const interactions = props.entries.filter((entry) => entry.kind === "interaction");
  const heap = props.entries.filter((entry) => entry.kind === "memory" && entry.value !== null);
  const lcp = props.entries.find((entry) => entry.kind === "lcp");
  const worst = (list: PerfLaneEntry[]) => Math.max(0, ...list.map((entry) => entry.duration ?? 0));
  return [
    {
      label: "Long tasks",
      value: String(longtasks.length),
      hint: longtasks.length ? `worst ${worst(longtasks)} ms` : "none over 50 ms",
      bad: worst(longtasks) > 200,
    },
    {
      label: "Slow taps",
      value: String(interactions.length),
      hint: interactions.length ? `worst ${worst(interactions)} ms` : "none over 104 ms",
      bad: worst(interactions) > 300,
    },
    {
      label: "Heap peak",
      value: heap.length ? formatBytes(Math.max(...heap.map((entry) => entry.value!))) : "—",
      hint: heap.length ? `${heap.length} samples` : "not reported",
      bad: false,
    },
    {
      label: "Largest paint",
      value: lcp?.value ? `${lcp.value} ms` : "—",
      hint: "from page load",
      bad: (lcp?.value ?? 0) > 2500,
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 gap-px border-b bg-border">
    <div v-for="tile in tiles" :key="tile.label" class="bg-background space-y-0.5 px-3 py-2">
      <div class="text-muted-foreground text-[10px] tracking-wide uppercase">{{ tile.label }}</div>
      <div :class="['tabular text-base font-semibold', tile.bad && 'text-destructive']">
        {{ tile.value }}
      </div>
      <div class="text-muted-foreground text-[11px]">{{ tile.hint }}</div>
    </div>
  </div>
</template>
