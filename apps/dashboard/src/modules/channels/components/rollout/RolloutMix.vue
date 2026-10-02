<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import DonutChart from "@/shared/components/charts/DonutChart.vue";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import { OTHER_VERSION, segmentFill, type MixSegment } from "../../lib/version-mix";

const props = defineProps<{
  segments: readonly MixSegment[];
  devices: number;
  onCurrent: number;
  /** The live bundle's version; null when nothing is live. */
  version: string | null;
  channelId: string;
}>();

const active = ref<string | null>(null);

const currentSegment = computed(
  () => props.segments.find((segment) => segment.tone === "current") ?? null,
);
const focused = computed(
  () =>
    props.segments.find((segment) => segment.version === active.value) ??
    currentSegment.value ??
    props.segments[0] ??
    null,
);
const behind = computed(() => Math.max(0, props.devices - props.onCurrent));
const donut = computed(() =>
  props.segments.map((segment) => ({
    key: segment.version,
    value: segment.devices,
    color: segment.color,
    hatched: segment.hatched,
  })),
);
const label = computed(() =>
  props.segments.map((segment) => `${segment.label} ${formatPercent(segment.share)}`).join(", "),
);

const linkTo = (segment: MixSegment) => ({
  name: RouteName.devices,
  query: { channel: props.channelId, version: segment.version },
});
const devicesWord = (count: number) => (count === 1 ? "device" : "devices");
</script>

<template>
  <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
    <DonutChart v-model:active="active" :segments="donut" :label="label">
      <template v-if="focused">
        <span class="block font-mono text-2xl leading-none font-semibold tracking-tight tabular">
          {{ formatPercent(focused.share) }}
        </span>
        <span
          class="mt-1 block max-w-24 truncate text-[11px]"
          :class="
            focused.tone === 'current' ? 'text-foreground font-mono' : 'text-muted-foreground'
          "
          :title="focused.label"
          >{{ focused.label }}</span
        >
        <span class="text-muted-foreground block text-[10px] tabular">
          {{ formatCount(focused.devices, true) }} {{ devicesWord(focused.devices) }}
        </span>
      </template>
      <span v-else class="text-muted-foreground text-xs">No devices</span>
    </DonutChart>

    <div class="w-full min-w-0 flex-1 space-y-3">
      <div v-if="props.version" class="space-y-0.5">
        <p class="text-sm">
          <span class="font-medium tabular">{{ formatCount(props.onCurrent, true) }}</span>
          <span class="text-muted-foreground">
            of {{ formatCount(props.devices, true) }} {{ devicesWord(props.devices) }} on</span
          >
          <span class="font-mono"> {{ props.version }}</span>
        </p>
        <p v-if="behind > 0" class="text-warning text-xs tabular">
          {{ formatCount(behind, true) }} still behind
        </p>
        <p v-else-if="props.devices > 0" class="text-success text-xs">Fully rolled out</p>
      </div>

      <ul class="space-y-0.5" aria-label="Versions on this channel">
        <li v-for="segment in props.segments" :key="segment.version">
          <component
            :is="segment.version === OTHER_VERSION ? 'div' : RouterLink"
            v-bind="segment.version === OTHER_VERSION ? {} : { to: linkTo(segment) }"
            class="grid grid-cols-[auto_minmax(0,1fr)_auto_3.5rem] items-center gap-2.5 rounded-md px-2 py-1 text-xs transition-[background-color,opacity]"
            :class="[
              active === segment.version ? 'bg-accent' : 'hover:bg-accent/60',
              active && active !== segment.version ? 'opacity-60' : '',
            ]"
            @pointerenter="active = segment.version"
            @pointerleave="active = null"
            @focus="active = segment.version"
            @blur="active = null"
          >
            <span
              class="size-2.5 rounded-sm"
              :class="segment.hatched && 'ring-border ring-1 ring-inset'"
              :style="{ background: segmentFill(segment) }"
              aria-hidden="true"
            />
            <span
              class="truncate"
              :class="[
                segment.tone === 'current'
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground',
                segment.tone === 'builtin' || segment.tone === 'other' ? '' : 'font-mono',
              ]"
              >{{ segment.label }}</span
            >
            <span class="text-muted-foreground font-mono tabular">{{
              formatCount(segment.devices)
            }}</span>
            <span class="text-right font-mono tabular">{{ formatPercent(segment.share) }}</span>
          </component>
        </li>
      </ul>
    </div>
  </div>
</template>
