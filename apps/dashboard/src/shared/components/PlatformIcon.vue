<script setup lang="ts">
import { Globe, Smartphone } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ platform: string | null | undefined; class?: string }>();

const LABELS: Record<string, string> = { android: "Android", ios: "iOS", web: "Web" };

const label = computed(() => LABELS[props.platform ?? ""] ?? "Unknown platform");
const glyph = computed(() =>
  props.platform === "android" || props.platform === "ios" || props.platform === "web"
    ? props.platform
    : "unknown",
);
</script>

<template>
  <svg
    v-if="glyph === 'android'"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="label"
    :class="cn('size-5 shrink-0', props.class)"
  >
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M3.5 18a8.5 8.5 0 0 1 17 0zM8.75 13.4a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2zm6.5 0a1.1 1.1 0 1 0 0 2.2a1.1 1.1 0 1 0 0-2.2z"
    />
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      d="M7.4 10.9 5.6 7.8M16.6 10.9l1.8-3.1"
    />
  </svg>
  <svg
    v-else-if="glyph === 'ios'"
    viewBox="0 0 24 24"
    role="img"
    :aria-label="label"
    :class="cn('size-5 shrink-0', props.class)"
  >
    <path
      fill="currentColor"
      d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.66-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.54zM14.17 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.58-2.57 1.32-.56.65-1.06 1.69-.92 2.69.98.08 1.98-.5 2.58-1.23z"
    />
  </svg>
  <Globe
    v-else-if="glyph === 'web'"
    role="img"
    :aria-label="label"
    :class="cn('size-5 shrink-0', props.class)"
  />
  <Smartphone v-else role="img" :aria-label="label" :class="cn('size-5 shrink-0', props.class)" />
</template>
