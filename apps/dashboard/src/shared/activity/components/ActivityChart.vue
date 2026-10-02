<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import StackedBars from "@/shared/components/charts/StackedBars.vue";
import type { ChartMarker } from "@/shared/components/charts/types";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import { ACTIVITY_SERIES, activityValues } from "../lib/activity-series";
import type { ActivityView } from "../types";

const props = withDefaults(
  defineProps<{
    view: ActivityView | null;
    error: unknown;
    retry: () => unknown;
    /** The previous window is on screen while the asked one loads. */
    stale: boolean;
    height?: number;
    markers?: readonly ChartMarker[];
  }>(),
  { height: 140, markers: () => [] },
);
const emit = defineEmits<{ select: [bucket: string] }>();

const values = computed(() =>
  props.view ? activityValues(props.view.keys, props.view.series) : {},
);
const quiet = computed(() =>
  props.view ? ACTIVITY_SERIES.every((entry) => !props.view?.totals[entry.key]) : false,
);
</script>

<template>
  <div v-if="props.error" class="px-2 pt-2">
    <ErrorNotice :error="props.error" :retry="props.retry" />
  </div>
  <Skeleton v-else-if="!props.view" class="mx-2 mt-2" :style="{ height: `${props.height}px` }" />
  <div
    v-else
    :class="['relative transition-opacity', props.stale && 'opacity-50']"
    :aria-busy="props.stale"
  >
    <StackedBars
      :buckets="props.view.keys"
      :granularity="props.view.bucket"
      :series="ACTIVITY_SERIES"
      :values="values"
      :height="props.height"
      :legend="false"
      :markers="props.markers"
      :selectable="props.view.bucket === 'day' && props.view.keys.length > 1"
      label="Events per bucket over the period"
      @select="emit('select', $event)"
    />
    <p
      v-if="quiet"
      class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-xs"
    >
      No activity in this period.
    </p>
  </div>
</template>
