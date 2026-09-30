<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import type { BuildEvent } from "@/shared/types/build";

const props = withDefaults(defineProps<{ events: readonly BuildEvent[]; limit?: number }>(), {
  limit: 4,
});

/** The latest status of each step, in the order steps first appeared. */
const steps = computed(() => {
  const latest = new Map<string, BuildEvent>();
  for (const event of props.events) {
    if (event.status === "info") continue;
    latest.set(event.step, event);
  }
  return [...latest.values()].slice(-props.limit);
});

const TONE: Record<BuildEvent["status"], string> = {
  running: "bg-info animate-pulse",
  succeeded: "bg-success",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground/40",
  info: "bg-muted-foreground/40",
};
</script>

<template>
  <ol v-if="steps.length" class="space-y-1">
    <li
      v-for="step in steps"
      :key="step.step"
      class="flex items-center gap-2 text-[11px]"
      :title="step.message ?? undefined"
    >
      <span :class="cn('size-1.5 shrink-0 rounded-full', TONE[step.status])" />
      <span class="truncate font-mono">{{ step.step }}</span>
      <span class="text-muted-foreground ml-auto shrink-0">{{ step.status }}</span>
    </li>
  </ol>
</template>
