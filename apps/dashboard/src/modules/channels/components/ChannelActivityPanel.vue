<script setup lang="ts">
import { computed } from "vue";
import { Spinner } from "@/components/ui/spinner";
import ActivityChart from "@/shared/activity/components/ActivityChart.vue";
import ActivityTotals from "@/shared/activity/components/ActivityTotals.vue";
import PeriodPicker from "@/shared/period/components/PeriodPicker.vue";
import { dayPeriod, type Period, type ResolvedPeriod } from "@/shared/period/lib/period";
import type { ChannelHistoryEntry } from "@/shared/types/release";
import { useChannelActivity } from "../composables/useChannelActivity";
import { historyMarkers, KIND_COLOR } from "../lib/channel-history";

const props = defineProps<{
  appId: string;
  channelId: string;
  /** Pointer moves, newest first, drawn over the chart. */
  history: readonly ChannelHistoryEntry[];
  period: Period;
  resolved: ResolvedPeriod;
  now: Date;
}>();
const emit = defineEmits<{ change: [period: Period] }>();

const LEGEND = [
  { key: "deliver", label: "Delivery", color: KIND_COLOR.deliver },
  { key: "rollback", label: "Rollback", color: KIND_COLOR.rollback },
  { key: "pause", label: "Pause, resume", color: KIND_COLOR.pause },
] as const;

const activity = useChannelActivity(
  () => props.appId,
  () => props.channelId,
  () => props.resolved,
);
const view = computed(() => activity.data.value ?? null);
const markers = computed(() =>
  view.value ? historyMarkers(props.history, view.value.keys, view.value.bucket) : [],
);

function focusDay(bucket: string) {
  emit("change", dayPeriod(bucket));
}
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border" aria-labelledby="channel-activity-heading">
    <header class="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
      <h2 id="channel-activity-heading" class="flex items-center gap-2 text-sm font-medium">
        Activity
        <Spinner
          v-if="activity.isFetching.value"
          class="text-muted-foreground size-3"
          aria-label="Loading activity"
        />
      </h2>
      <PeriodPicker
        :period="props.period"
        :resolved="props.resolved"
        :now="props.now"
        :retention-days="null"
        @change="emit('change', $event)"
      />
    </header>
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-3 pb-1">
      <ActivityTotals
        :totals="view && !activity.error.value ? view.totals : null"
        :loading="!view && !activity.error.value"
        show-rate
      />
      <ul
        v-if="markers.length"
        class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
        aria-label="Channel changes drawn on the chart"
      >
        <li v-for="entry in LEGEND" :key="entry.key" class="flex items-center gap-1">
          <span
            class="h-3 w-0 border-l-[1.5px] border-dashed"
            :style="{ borderColor: entry.color }"
            aria-hidden="true"
          />
          {{ entry.label }}
        </li>
      </ul>
    </div>
    <div class="px-2 pb-3">
      <ActivityChart
        :view="view"
        :error="activity.error.value"
        :retry="activity.refetch"
        :stale="activity.isPlaceholderData.value"
        :markers="markers"
        @select="focusDay"
      />
    </div>
  </section>
</template>
