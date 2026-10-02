<script setup lang="ts">
import { computed } from "vue";
import { Spinner } from "@/components/ui/spinner";
import ActivityChart from "@/shared/activity/components/ActivityChart.vue";
import PeriodPicker from "@/shared/period/components/PeriodPicker.vue";
import { dayPeriod, type Period, type ResolvedPeriod } from "@/shared/period/lib/period";
import { useDeviceActivity } from "../composables/useDeviceActivity";
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

const activity = useDeviceActivity(
  () => props.appId,
  () => props.deviceId,
  () => props.resolved,
);
const view = computed(() => activity.data.value ?? null);

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
      <ActivityChart
        :view="view"
        :error="activity.error.value"
        :retry="activity.refetch"
        :stale="activity.isPlaceholderData.value"
        @select="focusDay"
      />
    </div>
  </section>
</template>
