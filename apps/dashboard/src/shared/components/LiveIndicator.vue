<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tone } from "../lib/tone";
import { useLiveStore } from "../stores/live.store";
import StatusDot from "./StatusDot.vue";

const { status } = storeToRefs(useLiveStore());

const VIEW: Record<string, { label: string; tone: Tone; hint: string }> = {
  live: {
    label: "Live",
    tone: "success",
    hint: "Channel, build and device events arrive as they happen.",
  },
  connecting: { label: "Connecting", tone: "info", hint: "Opening the event stream." },
  reconnecting: {
    label: "Reconnecting",
    tone: "warning",
    hint: "The event stream dropped. Data is refetched once it is back.",
  },
  offline: {
    label: "Offline",
    tone: "danger",
    hint: "The browser is offline. Views show the last known state.",
  },
  idle: { label: "Paused", tone: "muted", hint: "No app is open." },
};

const view = computed(() => VIEW[status.value] ?? VIEW.idle!);
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <span
        class="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
        role="status"
      >
        <StatusDot :tone="view.tone" :pulse="status === 'live'" />
        {{ view.label }}
      </span>
    </TooltipTrigger>
    <TooltipContent class="max-w-64">{{ view.hint }}</TooltipContent>
  </Tooltip>
</template>
