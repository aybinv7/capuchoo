<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, ref } from "vue";
import { formatCount } from "@/shared/lib/format";
import { niceMax } from "../lib/series";
import type { BarSeries } from "../types/statistics.types";

const props = withDefaults(
  defineProps<{
    days: readonly string[];
    series: readonly BarSeries[];
    values: Readonly<Record<string, readonly number[]>>;
    height?: number;
    label: string;
  }>(),
  { height: 200 },
);

const PAD = { top: 8, right: 8, bottom: 22, left: 36 };
const GAP = 2;

const host = ref<HTMLElement | null>(null);
const { width } = useElementSize(host);
const hovered = ref<number | null>(null);

const plotWidth = computed(() => Math.max(0, width.value - PAD.left - PAD.right));
const plotHeight = computed(() => props.height - PAD.top - PAD.bottom);
const totals = computed(() =>
  props.days.map((_, index) =>
    props.series.reduce((sum, entry) => sum + (props.values[entry.key]?.[index] ?? 0), 0),
  ),
);
const max = computed(() => niceMax(Math.max(0, ...totals.value)));
const slot = computed(() => (props.days.length ? plotWidth.value / props.days.length : 0));
const barWidth = computed(() => Math.max(2, Math.min(28, slot.value * 0.68)));
const scale = (value: number) => (value / max.value) * plotHeight.value;

const bars = computed(() =>
  props.days.map((day, index) => {
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
    return { day, index, x, segments };
  }),
);

const ticks = computed(() =>
  [0, 0.5, 1].map((fraction) => ({
    value: max.value * fraction,
    y: PAD.top + plotHeight.value * (1 - fraction),
  })),
);
const labelEvery = computed(() => Math.max(1, Math.ceil(props.days.length / 8)));
const shortDay = (day: string) => day.slice(5).replace("-", "/");

const tooltip = computed(() => {
  const index = hovered.value;
  if (index === null) return null;
  const x = PAD.left + index * slot.value + slot.value / 2;
  return {
    day: props.days[index] ?? "",
    left: Math.min(Math.max(x, 80), width.value - 80),
    rows: props.series.map((entry) => ({
      ...entry,
      value: props.values[entry.key]?.[index] ?? 0,
    })),
  };
});
</script>

<template>
  <figure class="space-y-2">
    <figcaption class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span
        v-for="entry in props.series"
        :key="entry.key"
        class="text-muted-foreground flex items-center gap-1.5"
      >
        <span class="size-2.5 rounded-sm" :style="{ background: entry.color }" />
        {{ entry.label }}
      </span>
    </figcaption>
    <div
      ref="host"
      class="relative"
      :style="{ height: `${props.height}px` }"
      @mouseleave="hovered = null"
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
        <g v-for="bar in bars" :key="bar.day">
          <rect
            :x="PAD.left + bar.index * slot"
            :y="PAD.top"
            :width="slot"
            :height="plotHeight"
            :fill="hovered === bar.index ? 'var(--accent)' : 'transparent'"
            @mouseenter="hovered = bar.index"
          />
          <rect
            v-for="segment in bar.segments"
            :key="segment.key"
            :x="bar.x"
            :y="segment.y"
            :width="barWidth"
            :height="segment.height"
            :fill="segment.color"
            rx="2"
            class="pointer-events-none"
          />
          <text
            v-if="bar.index % labelEvery === 0"
            :x="PAD.left + bar.index * slot + slot / 2"
            :y="props.height - 6"
            text-anchor="middle"
            class="fill-muted-foreground font-mono text-[10px]"
          >
            {{ shortDay(bar.day) }}
          </text>
        </g>
      </svg>
      <div
        v-if="tooltip"
        class="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-md border px-2.5 py-2 text-xs shadow-md"
        :style="{ left: `${tooltip.left}px` }"
      >
        <div class="mb-1 font-mono font-medium">{{ tooltip.day }}</div>
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
      </div>
    </div>
  </figure>
</template>
