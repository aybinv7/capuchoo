<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { buildTone, isBuildActive } from "../lib/tone";
import type { BuildStatus } from "../types/build";
import StatusDot from "./StatusDot.vue";

const props = defineProps<{ status: BuildStatus; class?: string }>();

const TEXT = {
  success: "text-success",
  danger: "text-destructive",
  info: "text-info",
  warning: "text-warning",
  muted: "text-muted-foreground",
} as const;

const tone = computed(() => buildTone(props.status));
</script>

<template>
  <span
    :class="
      cn('inline-flex items-center gap-1.5 text-xs font-medium capitalize', TEXT[tone], props.class)
    "
  >
    <StatusDot :tone="tone" :pulse="isBuildActive(props.status)" />
    {{ props.status }}
  </span>
</template>
