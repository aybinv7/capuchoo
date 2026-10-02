<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, ref } from "vue";
import { formatCount } from "@/shared/lib/format";
import { bucketTitle, tickLabel } from "./lib/bucket-label";
import { markersAt } from "./lib/markers";
import { niceMax } from "./lib/scale";
import type { BarGranularity, BarSeries, ChartMarker } from "./types";

const props = withDefaults(
  defineProps<{
    /** One key per bar, oldest first: `YYYY-MM-DD` or `YYYY-MM-DDTHH`. */
    buckets: readonly string[];
    granularity?: BarGranularity;
    series: readonly BarSeries[];
    values: Readonly<Record<string, readonly number[]>>;
    height?: number;
    label: string;
    legend?: boolean;
    /** Moments drawn over the bars, listed in the tooltip of their bucket. */
    markers?: readonly ChartMarker[];
    /** Bars answer a click with `select`. */
    selectable?: boolean;
  }>(),
  { granularity: "day", height: 200, legend: true, selectable: false, markers: () => [] },
);

const emit = defineEmits<{ select: [bucket: string] }>();

const PAD = { top: 8, right: 8, bottom: 22, left: 36 };
const GAP = 2;
const TOOLTIP_HALF = 80;
const WIDE_TOOLTIP_HALF = 112;

const host = ref<HTMLElement | null>(null);
const { width } = useElementSize(host);
const hovered = ref<number | null>(null);

const plotWidth = computed(() => Math.max(0, width.value - PAD.left - PAD.right));
const plotHeight = computed(() => props.height - PAD.top - PAD.bottom);
const totals = computed(() =>
  props.buckets.map((_, index) =>
    props.series.reduce((sum, entry) => sum + (props.values[entry.key]?.[index] ?? 0), 0),
  ),
);
const max = computed(() => niceMax(Math.max(0, ...totals.value)));
const slot = computed(() => (props.buckets.length ? plotWidth.value / props.buckets.length : 0));
const barWidth = computed(() => Math.max(2, Math.min(28, slot.value * 0.68)));
const scale = (value: number) => (value / max.value) * plotHeight.value;

const bars = computed(() =>
  props.buckets.map((bucket, index) => {
    let offset = 0;
    const x = PAD.left + index * slot.value + (slot.value - barWidth.value) / 2;
    const segments = props.series
      .map((entry) => {
        const value = props.values[entry.key]?.[index] ?? 0;
        if (value <= 0) return null;
        const height = Math.max(1, scale(value) - (offset > 0 ? GAP : 0));
        const y = PAD.top + plotHeight.value - scale(offset) - scale(value);
        offset += value;
        return { key: entry.key, color: entry.color, y, height };
      })
      .filter((segment): segment is NonNullable<typeof segment> => segment !== null);
    return { bucket, index, x, segments };
  }),
);

const ticks = computed(() =>
  [0, 0.5, 1].map((fraction) => ({
    value: max.value * fraction,
    y: PAD.top + plotHeight.value * (1 - fraction),
  })),
);
const labelEvery = computed(() => Math.max(1, Math.ceil(props.buckets.length / 8)));

const tooltip = computed(() => {
  const index = hovered.value;
  if (index === null || index >= props.buckets.length) return null;
  const x = PAD.left + index * slot.value + slot.value / 2;
  const moments = markersAt(props.markers, index);
  const half = moments.length ? WIDE_TOOLTIP_HALF : TOOLTIP_HALF;
  return {
    title: bucketTitle(props.buckets[index] ?? "", props.granularity),
    left: Math.min(Math.max(x, half), width.value - half),
    wide: moments.length > 0,
    total: totals.value[index] ?? 0,
    rows: props.series.map((entry) => ({
      ...entry,
      value: props.values[entry.key]?.[index] ?? 0,
    })),
    moments,
  };
});

const rules = computed(() =>
  props.markers.map((marker) => ({
    ...marker,
    x: PAD.left + (marker.index + marker.offset) * slot.value,
  })),
);

function indexAt(event: PointerEvent | MouseEvent): number | null {
  if (!slot.value) return null;
  const bounds = host.value?.getBoundingClientRect();
  if (!bounds) return null;
  const index = Math.floor((event.clientX - bounds.left - PAD.left) / slot.value);
  return index >= 0 && index < props.buckets.length ? index : null;
}

function track(event: PointerEvent) {
  hovered.value = indexAt(event);
}

function choose(event: MouseEvent) {
  if (!props.selectable) return;
  const index = indexAt(event);
  const bucket = index === null ? undefined : props.buckets[index];
  if (bucket) emit("select", bucket);
}
</script>

<template>
  <figure class="space-y-2">
    <figcaption v-if="props.legend" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span
        v-for="entry in props.series"
        :key="entry.key"
        class="text-muted-foreground flex items-center gap-1.5"
      >
        <span class="size-2.5 rounded-sm" :style="{ background: entry.color }" />
        {{ entry.label }}
      </span>
    </figcaption>
    <figcaption v-else class="sr-only">{{ props.label }}</figcaption>
    <div
      ref="host"
      :class="['relative touch-pan-y', props.selectable && hovered !== null && 'cursor-pointer']"
      :style="{ height: `${props.height}px` }"
      @pointermove="track"
      @pointerleave="hovered = null"
      @click="choose"
    >
      <svg
        v-if="width > 0"
        :width="width"
        :height="props.height"
        role="img"
        :aria-label="props.label"
      >
        <g>
          <template v-for="tick in ticks" :key="tick.value">
            <line
              :x1="PAD.left"
              :x2="width - PAD.right"
              :y1="tick.y"
              :y2="tick.y"
              stroke="var(--border)"
              :stroke-dasharray="tick.value === 0 ? undefined : '2 3'"
            />
            <text
              :x="PAD.left - 6"
              :y="tick.y + 3"
              text-anchor="end"
              class="fill-muted-foreground font-mono text-[10px]"
            >
              {{ formatCount(tick.value) }}
            </text>
          </template>
        </g>
        <rect
          v-if="hovered !== null"
          :x="PAD.left + hovered * slot"
          :y="PAD.top"
          :width="slot"
          :height="plotHeight"
          fill="var(--accent)"
          class="pointer-events-none"
        />
        <g v-for="bar in bars" :key="bar.bucket" class="pointer-events-none">
          <rect
            v-for="segment in bar.segments"
            :key="segment.key"
            :x="bar.x"
            :y="segment.y"
            :width="barWidth"
            :height="segment.height"
            :fill="segment.color"
            rx="2"
          />
          <text
            v-if="bar.index % labelEvery === 0"
            :x="PAD.left + bar.index * slot + slot / 2"
            :y="props.height - 6"
            text-anchor="middle"
            class="fill-muted-foreground font-mono text-[10px]"
          >
            {{ tickLabel(bar.bucket, props.granularity) }}
          </text>
        </g>
        <g v-for="rule in rules" :key="rule.key" class="pointer-events-none">
          <line
            :x1="rule.x"
            :x2="rule.x"
            :y1="PAD.top + 3"
            :y2="PAD.top + plotHeight"
            :stroke="rule.color"
            stroke-width="1.5"
            stroke-dasharray="3 2"
          />
          <circle :cx="rule.x" :cy="PAD.top + 3" r="3" :fill="rule.color" />
        </g>
      </svg>
      <div
        v-if="tooltip"
        :class="[
          'bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border px-2.5 py-2 text-xs shadow-md',
          tooltip.wide ? 'w-56' : 'w-40',
        ]"
        :style="{ left: `${tooltip.left}px` }"
      >
        <div class="mb-1 flex items-baseline justify-between gap-2">
          <span class="font-medium">{{ tooltip.title }}</span>
          <span class="text-muted-foreground font-mono tabular">{{
            formatCount(tooltip.total, true)
          }}</span>
        </div>
        <div
          v-for="row in tooltip.rows"
          :key="row.key"
          class="flex items-center justify-between gap-2"
        >
          <span class="text-muted-foreground flex items-center gap-1.5">
            <span class="size-2 rounded-sm" :style="{ background: row.color }" />
            {{ row.label }}
          </span>
          <span class="font-mono tabular">{{ formatCount(row.value, true) }}</span>
        </div>
        <ul v-if="tooltip.moments.length" class="mt-1.5 space-y-1 border-t pt-1.5">
          <li v-for="moment in tooltip.moments" :key="moment.key" class="flex items-start gap-1.5">
            <span class="mt-1 size-2 shrink-0 rounded-full" :style="{ background: moment.color }" />
            <span class="min-w-0 break-words">{{ moment.label }}</span>
          </li>
        </ul>
        <div v-if="props.selectable" class="text-muted-foreground mt-1.5 border-t pt-1.5">
          Click to focus this {{ props.granularity }}
        </div>
      </div>
    </div>
  </figure>
</template>
