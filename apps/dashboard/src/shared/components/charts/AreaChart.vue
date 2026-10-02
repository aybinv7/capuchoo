<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, ref, useId } from "vue";
import { formatCount } from "@/shared/lib/format";
import { areaGeometry, nearestIndex, pointX, type PlotBox } from "./lib/area-path";
import { bucketTitle, tickLabel } from "./lib/bucket-label";
import { markersAt } from "./lib/markers";
import { niceMax } from "./lib/scale";
import type { ChartMarker } from "./types";

const props = withDefaults(
  defineProps<{
    /** One value per local day (`YYYY-MM-DD`), oldest first. */
    points: readonly { key: string; value: number }[];
    label: string;
    height?: number;
    color?: string;
    /** A reference the line climbs towards, drawn as a dashed rule. */
    ceiling?: number | null;
    /** The tooltip's value text, `19 devices`. */
    describe?: (value: number) => string;
    markers?: readonly ChartMarker[];
  }>(),
  {
    height: 120,
    color: "var(--primary)",
    ceiling: null,
    describe: (value: number) => formatCount(value, true),
    markers: () => [],
  },
);

const PAD = { top: 10, right: 12, bottom: 20, left: 32 };
const TOOLTIP_HALF = 96;

const gradient = `area-${useId()}`;
const host = ref<HTMLElement | null>(null);
const { width } = useElementSize(host);
const hovered = ref<number | null>(null);

const box = computed<PlotBox>(() => ({
  left: PAD.left,
  top: PAD.top,
  width: Math.max(0, width.value - PAD.left - PAD.right),
  height: props.height - PAD.top - PAD.bottom,
}));
const values = computed(() => props.points.map((point) => point.value));
const max = computed(() => niceMax(Math.max(props.ceiling ?? 0, 0, ...values.value)));
const geometry = computed(() => areaGeometry(values.value, max.value, box.value));
const baseline = computed(() => box.value.top + box.value.height);
const ceilingY = computed(() =>
  props.ceiling && props.ceiling > 0
    ? baseline.value - (props.ceiling / max.value) * box.value.height
    : null,
);
const step = computed(() =>
  props.points.length > 1 ? box.value.width / (props.points.length - 1) : 0,
);
const rules = computed(() =>
  props.markers.map((marker) => ({
    ...marker,
    x: Math.min(
      box.value.left + box.value.width,
      pointX(marker.index, props.points.length, box.value) + marker.offset * step.value,
    ),
  })),
);

function anchorOf(index: number, count: number): "start" | "middle" | "end" {
  if (count <= 1) return "middle";
  if (index === 0) return "start";
  return index === count - 1 ? "end" : "middle";
}

const ticks = computed(() => {
  const count = props.points.length;
  if (!count) return [];
  const picks = count > 4 ? [0, Math.floor((count - 1) / 2), count - 1] : [0, count - 1];
  return [...new Set(picks)].map((index) => ({
    index,
    x: pointX(index, count, box.value),
    text: tickLabel(props.points[index]?.key ?? "", "day"),
    anchor: anchorOf(index, count),
  }));
});

const tooltip = computed(() => {
  const index = hovered.value;
  if (index === null) return null;
  const point = props.points[index];
  const at = geometry.value.points[index];
  if (!point || !at) return null;
  return {
    x: at.x,
    y: at.y,
    left: Math.min(Math.max(at.x, TOOLTIP_HALF), width.value - TOOLTIP_HALF),
    title: bucketTitle(point.key, "day"),
    value: props.describe(point.value),
    moments: markersAt(props.markers, index),
  };
});

function track(event: PointerEvent) {
  const bounds = host.value?.getBoundingClientRect();
  hovered.value = bounds
    ? nearestIndex(event.clientX - bounds.left, props.points.length, box.value)
    : null;
}
</script>

<template>
  <figure>
    <figcaption class="sr-only">{{ props.label }}</figcaption>
    <div
      ref="host"
      class="relative touch-pan-y"
      :style="{ height: `${props.height}px` }"
      @pointermove="track"
      @pointerleave="hovered = null"
    >
      <svg
        v-if="width > 0"
        :width="width"
        :height="props.height"
        role="img"
        :aria-label="props.label"
      >
        <defs>
          <linearGradient :id="gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" :stop-color="props.color" stop-opacity="0.28" />
            <stop offset="100%" :stop-color="props.color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="baseline"
          :y2="baseline"
          stroke="var(--border)"
        />
        <text
          :x="PAD.left - 6"
          :y="baseline + 3"
          text-anchor="end"
          class="fill-muted-foreground font-mono text-[10px]"
        >
          0
        </text>
        <template v-if="ceilingY !== null">
          <line
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="ceilingY"
            :y2="ceilingY"
            stroke="var(--border)"
            stroke-dasharray="2 3"
          />
          <text
            :x="PAD.left - 6"
            :y="ceilingY + 3"
            text-anchor="end"
            class="fill-muted-foreground font-mono text-[10px]"
          >
            {{ formatCount(props.ceiling) }}
          </text>
        </template>
        <path :d="geometry.area" :fill="`url(#${gradient})`" />
        <path
          :d="geometry.line"
          fill="none"
          :stroke="props.color"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          v-if="geometry.points.length === 1"
          :cx="geometry.points[0]?.x"
          :cy="geometry.points[0]?.y"
          r="3"
          :fill="props.color"
        />
        <g v-for="rule in rules" :key="rule.key" class="pointer-events-none">
          <line
            :x1="rule.x"
            :x2="rule.x"
            :y1="PAD.top"
            :y2="baseline"
            :stroke="rule.color"
            stroke-width="1.5"
            stroke-dasharray="3 2"
          />
          <circle :cx="rule.x" :cy="PAD.top" r="3" :fill="rule.color" />
        </g>
        <text
          v-for="tick in ticks"
          :key="tick.index"
          :x="tick.x"
          :y="props.height - 5"
          :text-anchor="tick.anchor"
          class="fill-muted-foreground font-mono text-[10px]"
        >
          {{ tick.text }}
        </text>
        <g v-if="tooltip" class="pointer-events-none">
          <line
            :x1="tooltip.x"
            :x2="tooltip.x"
            :y1="PAD.top"
            :y2="baseline"
            stroke="var(--muted-foreground)"
            stroke-opacity="0.4"
          />
          <circle
            :cx="tooltip.x"
            :cy="tooltip.y"
            r="4"
            :fill="props.color"
            stroke="var(--popover)"
            stroke-width="2"
          />
        </g>
      </svg>
      <div
        v-if="tooltip"
        class="bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-md border px-2.5 py-2 text-xs shadow-md"
        :style="{ left: `${tooltip.left}px` }"
      >
        <div class="flex items-baseline justify-between gap-2">
          <span class="font-medium">{{ tooltip.title }}</span>
          <span class="font-mono tabular">{{ tooltip.value }}</span>
        </div>
        <ul v-if="tooltip.moments.length" class="mt-1.5 space-y-1 border-t pt-1.5">
          <li v-for="moment in tooltip.moments" :key="moment.key" class="flex items-start gap-1.5">
            <span class="mt-1 size-2 shrink-0 rounded-full" :style="{ background: moment.color }" />
            <span class="min-w-0 break-words">{{ moment.label }}</span>
          </li>
        </ul>
      </div>
    </div>
  </figure>
</template>
