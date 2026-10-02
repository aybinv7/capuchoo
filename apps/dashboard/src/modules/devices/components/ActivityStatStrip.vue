<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import ActivityTotals from "@/shared/activity/components/ActivityTotals.vue";
import type { ActivityCategory } from "@/shared/activity/types";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { actionLabel } from "../lib/event-labels";
import type { DeviceSummary } from "../types/devices.types";

const props = defineProps<{
  totals: Record<ActivityCategory, number> | null;
  loading: boolean;
  summary: DeviceSummary | null;
}>();

const lastDelivered = computed(() => props.summary?.last_delivered ?? null);
const lastFailure = computed(() => props.summary?.last_failure ?? null);
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
    <ActivityTotals :totals="props.totals" :loading="props.loading" />
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
