<template>
  <span
    class="inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold"
    :class="classes"
  >
    <span class="size-1.5 rounded-full" :class="dot" aria-hidden="true" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
import type { Environment } from "@/shared/database/schema";

/** A channel's environment, in the colour the dashboard gives it. */
const props = defineProps<{ environment: Environment | null; label?: string }>();

const classes = computed(() => {
  switch (props.environment) {
    case "dev":
      return "bg-env-dev-container text-env-dev-foreground";
    case "staging":
      return "bg-env-staging-container text-env-staging-foreground";
    case "prod":
      return "bg-env-prod-container text-env-prod-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
});

const dot = computed(() => {
  switch (props.environment) {
    case "dev":
      return "bg-env-dev";
    case "staging":
      return "bg-env-staging";
    case "prod":
      return "bg-env-prod";
    default:
      return "bg-muted-foreground";
  }
});

const label = computed(() => props.label ?? props.environment ?? "—");
</script>
