<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { Tone } from "../lib/tone";

const props = withDefaults(defineProps<{ tone: Tone; pulse?: boolean; class?: string }>(), {
  pulse: false,
});

const TONE: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground/50",
};
</script>

<template>
  <span :class="cn('relative inline-flex size-2 shrink-0', props.class)">
    <span
      v-if="props.pulse"
      :class="cn('absolute inset-0 animate-ping rounded-full opacity-60', TONE[props.tone])"
    />
    <span :class="cn('relative inline-flex size-2 rounded-full', TONE[props.tone])" />
  </span>
</template>
