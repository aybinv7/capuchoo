<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import StackedBars from "@/shared/components/charts/StackedBars.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PeriodPicker from "@/shared/period/components/PeriodPicker.vue";
import { dayPeriod, type Period, type ResolvedPeriod } from "@/shared/period/lib/period";
import { useDeviceActivity } from "../composables/useDeviceActivity";
import { ACTIVITY_SERIES, activityValues } from "../lib/activity-series";
import type { DeviceSummary } from "../types/devices.types";
import ActivityStatStrip from "./ActivityStatStrip.vue";

const props = defineProps<{
  appId: string;
  deviceId: string;
  summary: DeviceSummary | null;
  period: Period;
  resolved: ResolvedPeriod;
  now: Date;
  retentionDays: number | null;
}>();
const emit = defineEmits<{ change: [period: Period] }>();

const CHART_HEIGHT = 140;

const activity = useDeviceActivity(
  () => props.appId,
  () => props.deviceId,
  () => props.resolved,
);
const view = computed(() => activity.data.value ?? null);
const values = computed(() =>
  view.value ? activityValues(view.value.keys, view.value.series) : {},
);
const quiet = computed(() =>
  view.value ? ACTIVITY_SERIES.every((entry) => !view.value?.totals[entry.key]) : false,
);
const stale = computed(() => activity.isPlaceholderData.value);

function focusDay(bucket: string) {
  emit("change", dayPeriod(bucket));
}
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border" aria-labelledby="device-activity-heading">
    <header class="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
      <h2 id="device-activity-heading" class="flex items-center gap-2 text-sm font-medium">
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
        :retention-days="props.retentionDays"
        @change="emit('change', $event)"
      />
    </header>
    <div class="px-4 pt-3 pb-1">
      <ActivityStatStrip
        :totals="view && !activity.error.value ? view.totals : null"
        :loading="!view && !activity.error.value"
        :summary="props.summary"
      />
    </div>
    <div class="px-2 pb-3">
      <div v-if="activity.error.value" class="px-2 pt-2">
        <ErrorNotice :error="activity.error.value" :retry="activity.refetch" />
      </div>
      <Skeleton v-else-if="!view" class="mx-2 mt-2" :style="{ height: `${CHART_HEIGHT}px` }" />
      <div
        v-else
        :class="['relative transition-opacity', stale && 'opacity-50']"
        :aria-busy="stale"
      >
        <StackedBars
          :buckets="view.keys"
          :granularity="view.bucket"
          :series="ACTIVITY_SERIES"
          :values="values"
          :height="CHART_HEIGHT"
          :legend="false"
          :selectable="view.bucket === 'day' && view.keys.length > 1"
          label="Events per bucket over the period"
          @select="focusDay"
        />
        <p
          v-if="quiet"
          class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-xs"
        >
          No activity in this period.
        </p>
      </div>
    </div>
  </section>
</template>
