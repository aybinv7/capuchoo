<template>
  <div class="chart-card">
    <div class="flex items-baseline justify-between gap-2 px-1">
      <span class="text-base font-semibold">{{ title }}</span>
      <span class="text-xs text-muted-foreground">{{ caption }}</span>
    </div>
    <F7AreaChart
      class="daily-chart"
      :datasets="datasets"
      :axis-labels="labels"
      :width="640"
      :height="240"
      :max-axis-labels="5"
      :format-axis-label="formatLabel"
      :format-tooltip-axis-label="formatLabel"
      axis
      tooltip
      legend
      toggle-datasets
    />
  </div>
</template>

<script setup lang="ts">
export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

/**
 * A day-by-day series as Framework7's area chart: stacked, with its own legend to hide a series
 * and a tooltip on touch. Days are labelled in the reader's language.
 */
const props = defineProps<{
  title: string;
  caption: string;
  days: string[];
  series: ChartSeries[];
}>();
const { locale } = useI18n();

const datasets = computed(() => props.series.map((entry) => ({ ...entry })));
const labels = computed(() => props.days);

function formatLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale.value, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
</script>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 12px 12px;
  border-radius: var(--radius-xl);
  background: var(--card);
}

.daily-chart :deep(svg) {
  width: 100%;
  height: auto;
  border-radius: 12px;
}

.daily-chart :deep(.area-chart-axis) {
  color: var(--muted-foreground);
  font-size: 11px;
}

.daily-chart :deep(.area-chart-legend) {
  justify-content: flex-start;
  gap: 4px 12px;
}

.daily-chart :deep(.area-chart-legend-item) {
  color: var(--foreground);
  font-size: 13px;
}

.daily-chart :deep(.area-chart-current-line) {
  stroke: var(--foreground);
  stroke-opacity: 0.4;
}
</style>
