<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatCount } from "@/shared/lib/format";
import { ACTIVITY_SERIES } from "../lib/activity-series";
import { actionLabel } from "../lib/event-labels";
import type { DeviceEventCategory, DeviceSummary } from "../types/devices.types";

const props = defineProps<{
  totals: Record<DeviceEventCategory, number> | null;
  loading: boolean;
  summary: DeviceSummary | null;
}>();

const ORDER = ["check", "delivered", "failed", "downloading"] as const;

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
const lastDelivered = computed(() => props.summary?.last_delivered ?? null);
const lastFailure = computed(() => props.summary?.last_failure ?? null);
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
    <ul class="flex flex-wrap items-center gap-x-5 gap-y-1.5" aria-label="Totals for the period">
      <li v-for="stat in stats" :key="stat.key" class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :style="{ background: stat.color }" aria-hidden="true" />
        <Skeleton v-if="props.loading" class="h-4 w-8" />
        <span v-else class="font-mono text-sm font-semibold tabular">{{
          formatCount(stat.value)
        }}</span>
        <span class="text-muted-foreground text-xs">{{ stat.label }}</span>
      </li>
    </ul>
    <dl class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <div class="flex min-w-0 items-center gap-1">
        <dt>Last delivery</dt>
        <dd v-if="!props.summary"><Skeleton class="h-3 w-20" /></dd>
        <dd v-else-if="lastDelivered" class="flex min-w-0 items-center gap-1">
          <span class="text-foreground max-w-[16ch] truncate font-mono">{{
            lastDelivered.version ?? "unknown version"
          }}</span>
          · <RelativeTime :value="lastDelivered.at" />
        </dd>
        <dd v-else>none</dd>
      </div>
      <div class="flex min-w-0 items-center gap-1">
        <dt>Last failure</dt>
        <dd v-if="!props.summary"><Skeleton class="h-3 w-20" /></dd>
        <dd
          v-else-if="lastFailure"
          class="flex min-w-0 items-center gap-1"
          :title="lastFailure.error ?? undefined"
        >
          <span class="text-destructive max-w-[20ch] truncate">{{
            actionLabel(lastFailure.action)
          }}</span>
          · <RelativeTime :value="lastFailure.at" />
        </dd>
        <dd v-else>none</dd>
      </div>
    </dl>
  </div>
</template>
