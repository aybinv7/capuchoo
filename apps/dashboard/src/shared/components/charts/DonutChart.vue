<script setup lang="ts">
import { computed, useId } from "vue";
import { donutArcs } from "./lib/donut-arcs";

export interface DonutSegment {
  key: string;
  value: number;
  color: string;
  hatched?: boolean;
}

const props = withDefaults(
  defineProps<{
    segments: readonly DonutSegment[];
    label: string;
    size?: number;
    thickness?: number;
    gap?: number;
  }>(),
  { size: 148, thickness: 14, gap: 3 },
);

/** The highlighted segment's key, shared with whatever legend sits beside the ring. */
const active = defineModel<string | null>("active", { default: null });

const patternId = `donut-hatch-${useId()}`;
const radius = computed(() => (props.size - props.thickness - 6) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const centre = computed(() => props.size / 2);

const arcs = computed(() => {
  const byKey = new Map(props.segments.map((segment) => [segment.key, segment]));
  return donutArcs(props.segments, circumference.value, props.gap).map((arc) => ({
    ...arc,
    segment: byKey.get(arc.key)!,
  }));
});

const hatchColor = computed(() => props.segments.find((segment) => segment.hatched)?.color ?? null);

const stroke = (segment: DonutSegment) => (segment.hatched ? `url(#${patternId})` : segment.color);
</script>

<template>
  <div
    class="relative grid shrink-0 place-items-center"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    role="img"
    :aria-label="props.label"
    @pointerleave="active = null"
  >
    <svg
      :width="props.size"
      :height="props.size"
      :viewBox="`0 0 ${props.size} ${props.size}`"
      class="absolute inset-0 -rotate-90 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <pattern
          v-if="hatchColor"
          :id="patternId"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" :fill="hatchColor" opacity="0.35" />
          <rect width="2" height="5" :fill="hatchColor" />
        </pattern>
      </defs>
      <circle
        :cx="centre"
        :cy="centre"
        :r="radius"
        fill="none"
        stroke="var(--muted)"
        :stroke-width="props.thickness"
      />
      <circle
        v-for="arc in arcs"
        :key="arc.key"
        :cx="centre"
        :cy="centre"
        :r="radius"
        fill="none"
        :stroke="stroke(arc.segment)"
        :stroke-width="active === arc.key ? props.thickness + 5 : props.thickness"
        :stroke-dasharray="`${arc.length} ${circumference}`"
        :stroke-dashoffset="arc.offset"
        :opacity="active && active !== arc.key ? 0.35 : 1"
        class="cursor-pointer transition-[stroke-width,opacity,stroke-dasharray] duration-300 ease-out"
        @pointerenter="active = arc.key"
      />
    </svg>
    <div class="pointer-events-none relative px-4 text-center">
      <slot />
    </div>
  </div>
</template>
