<script setup lang="ts" generic="E extends DeviceEvent">
import { ChevronRight, RefreshCw } from "@lucide/vue";
import { computed, ref } from "vue";
import { cn } from "@/lib/utils";
import { formatClock, formatCount } from "@/shared/lib/format";
import { versionLabel } from "../lib/event-labels";
import { deviceCount } from "../lib/timeline";
import type { DeviceEvent } from "../types/devices.types";

const SHOWN = 100;

const props = defineProps<{ events: readonly E[]; from: string; to: string }>();
defineSlots<{ subject?: (scope: { event: E }) => unknown }>();

const expanded = ref(false);
const devices = computed(() => deviceCount(props.events));
const shown = computed(() => (expanded.value ? props.events.slice(0, SHOWN) : []));
</script>

<template>
  <div class="py-2">
    <button
      type="button"
      class="group/run flex w-full items-center gap-3 rounded-md text-left"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span
        class="bg-muted text-muted-foreground relative z-[1] grid size-6 shrink-0 place-items-center rounded-full"
      >
        <RefreshCw class="size-3.5" />
      </span>
      <span class="text-muted-foreground min-w-0 flex-1 text-sm">
        <span class="text-foreground font-medium tabular"
          >{{ formatCount(props.events.length, true) }} checks</span
        >
        <template v-if="devices !== null">
          from {{ formatCount(devices, true) }} device{{ devices === 1 ? "" : "s" }}</template
        >
        between
        <time :datetime="props.from" class="font-mono text-xs tabular">{{
          formatClock(props.from, false)
        }}</time>
        and
        <time :datetime="props.to" class="font-mono text-xs tabular">{{
          formatClock(props.to, false)
        }}</time>
      </span>
      <ChevronRight
        :class="
          cn(
            'text-muted-foreground group-hover/run:text-foreground size-4 shrink-0 transition-transform',
            expanded && 'rotate-90',
          )
        "
      />
    </button>
    <ol v-if="expanded" class="mt-1 ml-9 space-y-0.5 border-l pl-3">
      <li
        v-for="event in shown"
        :key="event.id"
        class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 py-0.5 text-xs"
      >
        <time :datetime="event.created_at" class="text-muted-foreground font-mono tabular">{{
          formatClock(event.created_at)
        }}</time>
        <span v-if="versionLabel(event)" class="font-mono">{{ versionLabel(event) }}</span>
        <slot name="subject" :event="event" />
      </li>
      <li v-if="props.events.length > SHOWN" class="text-muted-foreground py-0.5 text-xs">
        and {{ formatCount(props.events.length - SHOWN, true) }} more. Filter by Checks to list each
        one.
      </li>
    </ol>
  </div>
</template>
