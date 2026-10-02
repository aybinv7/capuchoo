<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** Share filled, 0 to 1; null draws the empty track. */
    value: number | null;
    label: string;
    size?: number;
    thickness?: number;
    color?: string;
  }>(),
  { size: 96, thickness: 9, color: "var(--primary)" },
);

const radius = computed(() => (props.size - props.thickness) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const share = computed(() => Math.min(1, Math.max(0, props.value ?? 0)));
const dash = computed(() => `${circumference.value * share.value} ${circumference.value}`);
</script>

<template>
  <div
    class="relative grid shrink-0 place-items-center"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    role="meter"
    :aria-label="props.label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(share * 100)"
  >
    <svg
      :width="props.size"
      :height="props.size"
      class="absolute inset-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        :cx="props.size / 2"
        :cy="props.size / 2"
        :r="radius"
        fill="none"
        stroke="var(--muted)"
        :stroke-width="props.thickness"
      />
      <circle
        v-if="share > 0"
        :cx="props.size / 2"
        :cy="props.size / 2"
        :r="radius"
        fill="none"
        :stroke="props.color"
        :stroke-width="props.thickness"
        stroke-linecap="round"
        :stroke-dasharray="dash"
        class="transition-[stroke-dasharray] duration-700 ease-out"
      />
    </svg>
    <div class="relative text-center">
      <slot />
    </div>
  </div>
</template>
