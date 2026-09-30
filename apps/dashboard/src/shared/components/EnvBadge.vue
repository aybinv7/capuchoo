<script setup lang="ts">
import type { Environment } from "@capuchoo/core";
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ environment: Environment | null; size?: "sm" | "md" }>(), {
  size: "md",
});

const TONE: Record<Environment, string> = {
  dev: "text-env-dev bg-env-dev/10 ring-env-dev/25",
  staging: "text-env-staging bg-env-staging/10 ring-env-staging/25",
  prod: "text-env-prod bg-env-prod/10 ring-env-prod/25",
};
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 rounded font-mono font-medium uppercase tracking-wide ring-1 ring-inset',
        props.size === 'sm' ? 'px-1 py-px text-[10px]' : 'px-1.5 py-0.5 text-[11px]',
        props.environment ? TONE[props.environment] : 'text-muted-foreground ring-border',
      )
    "
  >
    <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
    {{ props.environment ?? "none" }}
  </span>
</template>
