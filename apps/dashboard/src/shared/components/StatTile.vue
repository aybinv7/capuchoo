<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "success" | "danger";
    /** A value that is a word rather than a number, set smaller so it fits. */
    textual?: boolean;
  }>(),
  { hint: undefined, tone: "default", textual: false },
);

const TONE = { default: "", success: "text-success", danger: "text-destructive" } as const;
</script>

<template>
  <div class="bg-card min-w-0 rounded-lg border px-4 py-3">
    <div class="text-muted-foreground text-xs">{{ props.label }}</div>
    <div
      :class="
        cn(
          'mt-1 truncate font-mono font-semibold tracking-tight tabular',
          props.textual ? 'text-base leading-8' : 'text-2xl',
          TONE[props.tone],
        )
      "
      :title="props.value"
    >
      {{ props.value }}
    </div>
    <div v-if="props.hint || $slots.hint" class="text-muted-foreground mt-0.5 truncate text-[11px]">
      <slot name="hint">{{ props.hint }}</slot>
    </div>
  </div>
</template>
