<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { ACTIVITY_SERIES, rateTone, successRate, type RateTone } from "../lib/activity-series";
import type { ActivityCategory } from "../types";

const props = withDefaults(
  defineProps<{
    totals: Record<ActivityCategory, number> | null;
    loading: boolean;
    /** Also show delivered against delivered plus failed. */
    showRate?: boolean;
  }>(),
  { showRate: false },
);

const ORDER = ["check", "delivered", "failed", "downloading"] as const;
const RATE_TEXT: Record<RateTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const stats = computed(() =>
  ORDER.map((key) => {
    const series = ACTIVITY_SERIES.find((entry) => entry.key === key);
    return {
      key,
      label: series?.label ?? key,
      color: series?.color ?? "var(--muted-foreground)",
      value: props.totals ? props.totals[key] : null,
    };
  }),
);
const rate = computed(() => (props.totals ? successRate(props.totals) : null));
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-5 gap-y-1.5" aria-label="Totals for the period">
    <li v-for="stat in stats" :key="stat.key" class="flex items-center gap-1.5">
      <span class="size-2 rounded-full" :style="{ background: stat.color }" aria-hidden="true" />
      <Skeleton v-if="props.loading" class="h-4 w-8" />
      <span v-else class="font-mono text-sm font-semibold tabular">{{
        formatCount(stat.value)
      }}</span>
      <span class="text-muted-foreground text-xs">{{ stat.label }}</span>
    </li>
    <li
      v-if="props.showRate"
      class="flex items-center gap-1.5 sm:border-l sm:pl-5"
      title="Delivered against delivered plus failed, over the period"
    >
      <Skeleton v-if="props.loading" class="h-4 w-10" />
      <span
        v-else
        :class="
          cn(
            'font-mono text-sm font-semibold tabular',
            rate === null ? 'text-muted-foreground' : RATE_TEXT[rateTone(rate)],
          )
        "
        >{{ formatPercent(rate) }}</span
      >
      <span class="text-muted-foreground text-xs">success</span>
    </li>
  </ul>
</template>
