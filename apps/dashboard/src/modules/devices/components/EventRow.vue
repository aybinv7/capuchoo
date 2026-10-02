<script setup lang="ts">
import { computed } from "vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { cn } from "@/lib/utils";
import { formatClock } from "@/shared/lib/format";
import { actionLabel, versionLabel } from "../lib/event-labels";
import { CATEGORY_VIEW } from "../lib/event-view";
import type { DeviceEvent } from "../types/devices.types";
import EventErrorText from "./EventErrorText.vue";

const props = defineProps<{ event: DeviceEvent }>();

const view = computed(() => CATEGORY_VIEW[props.event.category]);
const version = computed(() => versionLabel(props.event));
</script>

<template>
  <div class="flex gap-3 py-2">
    <span
      :class="cn('relative z-[1] grid size-6 shrink-0 place-items-center rounded-full', view.tone)"
      :title="view.label"
    >
      <component :is="view.icon" class="size-3.5" />
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="text-sm font-medium" :title="props.event.action">{{
          actionLabel(props.event.action)
        }}</span>
        <span v-if="version" class="font-mono text-xs tabular">{{ version }}</span>
        <span
          v-if="props.event.kind === 'native'"
          class="text-muted-foreground rounded border px-1 text-[10px] uppercase"
          >native</span
        >
        <span
          v-if="props.event.status && props.event.status !== props.event.action"
          class="text-muted-foreground font-mono text-[11px]"
          >{{ props.event.status }}</span
        >
        <span class="text-muted-foreground ml-auto flex shrink-0 items-baseline gap-1.5 text-xs">
          <time :datetime="props.event.created_at" class="font-mono tabular">{{
            formatClock(props.event.created_at)
          }}</time>
          <RelativeTime :value="props.event.created_at" class="hidden sm:inline" />
        </span>
      </div>
      <slot name="subject" />
      <EventErrorText v-if="props.event.error" :error="props.event.error" />
    </div>
  </div>
</template>
