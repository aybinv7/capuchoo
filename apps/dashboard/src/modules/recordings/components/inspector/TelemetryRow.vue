<script setup lang="ts">
import { CircleX, Gauge, Sparkle, Timer } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import type { TelemetryLaneEntry } from "../../types/recordings.types";

const props = defineProps<{ entry: TelemetryLaneEntry }>();

const style = computed(() => {
  if (props.entry.kind === "error") return { icon: CircleX, tone: "text-destructive" };
  if (props.entry.kind === "span" || props.entry.kind === "span-start") {
    return { icon: Timer, tone: "text-info" };
  }
  if (props.entry.kind === "measure") return { icon: Gauge, tone: "text-success" };
  return { icon: Sparkle, tone: "text-primary" };
});
const value = computed(() => {
  if (props.entry.duration !== null) return `${props.entry.duration} ms`;
  if (props.entry.kind === "span-start") return "started";
  const measured = props.entry.data?.value;
  return typeof measured === "number" ? String(measured) : null;
});
</script>

<template>
  <component :is="style.icon" :class="cn('size-3.5 shrink-0', style.tone)" aria-hidden="true" />
  <span class="min-w-0 flex-1 truncate font-mono text-[11px]" :title="props.entry.name">{{
    props.entry.name
  }}</span>
  <span v-if="value" class="text-muted-foreground tabular shrink-0 text-[10px]">{{ value }}</span>
</template>
