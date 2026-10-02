<script setup lang="ts">
import { computed } from "vue";
import RadialMeter from "@/shared/components/charts/RadialMeter.vue";
import { formatCount, formatPercent, ratio } from "@/shared/lib/format";

const props = defineProps<{ onCurrent: number; devices: number; version: string }>();

const share = computed(() => ratio(props.onCurrent, props.devices));
const behind = computed(() => Math.max(0, props.devices - props.onCurrent));
const color = computed(() =>
  share.value !== null && share.value >= 1 ? "var(--success)" : "var(--primary)",
);
</script>

<template>
  <div class="flex items-center gap-5">
    <RadialMeter
      :value="share"
      :color="color"
      :label="`${formatPercent(share)} of devices run ${props.version}`"
    >
      <span class="text-muted-foreground block font-mono text-[11px] leading-tight tabular"
        >{{ formatCount(props.onCurrent) }}<span class="opacity-60">/</span
        >{{ formatCount(props.devices) }}</span
      >
    </RadialMeter>
    <div class="min-w-0 space-y-1">
      <p class="font-mono text-4xl leading-none font-semibold tracking-tight tabular">
        {{ formatPercent(share) }}
      </p>
      <p class="text-muted-foreground text-sm">
        <span class="text-foreground font-medium tabular">{{
          formatCount(props.onCurrent, true)
        }}</span>
        of {{ formatCount(props.devices, true) }} devices on
        <span class="text-foreground font-mono">{{ props.version }}</span>
      </p>
      <p v-if="behind > 0" class="text-warning text-xs tabular">
        {{ formatCount(behind, true) }} still behind
      </p>
      <p v-else-if="props.devices > 0" class="text-success text-xs">Fully rolled out</p>
    </div>
  </div>
</template>
