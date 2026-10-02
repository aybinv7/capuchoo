<script setup lang="ts">
import { CircleArrowDown, CircleArrowUp, CircleCheck, CircleDot } from "@lucide/vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LaneStatus, LaneTone } from "./types";

const props = defineProps<{
  label: string;
  to?: RouteLocationRaw | null;
  status?: LaneStatus | null;
  /** The status is still being worked out (the catalog is loading). */
  pending?: boolean;
}>();

const TONE: Record<LaneTone, string> = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};
const ICON = {
  success: CircleCheck,
  warning: CircleArrowDown,
  info: CircleArrowUp,
  muted: CircleDot,
} as const;
</script>

<template>
  <component
    :is="props.to ? RouterLink : 'div'"
    :to="props.to ?? undefined"
    :class="
      cn(
        'flex h-full min-w-0 items-center gap-3 rounded-md px-3 py-2.5 outline-none',
        props.to &&
          'hover:bg-accent/60 focus-visible:ring-ring/50 transition-colors focus-visible:ring-3',
      )
    "
  >
    <span
      class="bg-surface text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4"
      aria-hidden="true"
    >
      <slot name="icon" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="text-muted-foreground block text-[10px] font-medium tracking-wide uppercase">{{
        props.label
      }}</span>
      <span class="flex min-w-0 items-center gap-1.5 font-mono text-sm">
        <slot />
      </span>
      <Skeleton v-if="props.pending" class="mt-1 h-3 w-24" />
      <span
        v-else-if="props.status"
        :class="cn('mt-0.5 flex min-w-0 items-center gap-1 text-[11px]', TONE[props.status.tone])"
      >
        <component :is="ICON[props.status.tone]" class="size-3 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ props.status.text }}</span>
      </span>
      <span v-else class="text-muted-foreground mt-0.5 block text-[11px]">&nbsp;</span>
    </span>
    <slot name="aside" />
  </component>
</template>
