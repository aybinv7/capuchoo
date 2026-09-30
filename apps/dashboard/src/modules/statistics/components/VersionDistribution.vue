<script setup lang="ts">
import { computed } from "vue";
import { formatCount, formatPercent } from "@/shared/lib/format";
import type { VersionShare } from "@/shared/types/stats";
import { versionBars } from "../lib/series";

const props = defineProps<{ versions: readonly VersionShare[] }>();

const bars = computed(() => versionBars(props.versions));
const total = computed(() => bars.value.reduce((sum, bar) => sum + bar.devices, 0));
const widest = computed(() => Math.max(1, ...bars.value.map((bar) => bar.devices)));
</script>

<template>
  <p v-if="bars.length === 0" class="text-muted-foreground py-6 text-center text-sm">
    No device reported a version in this window.
  </p>
  <ul v-else class="space-y-2" aria-label="Devices by running version">
    <li
      v-for="bar in bars"
      :key="bar.version"
      class="grid grid-cols-[7rem_1fr_5.5rem] items-center gap-3 text-xs"
      :title="`${bar.devices} devices on ${bar.version} (${bar.platforms.join(', ')})`"
    >
      <span class="truncate font-mono">{{ bar.version }}</span>
      <span class="bg-muted relative h-2.5 overflow-hidden rounded-sm">
        <span
          class="bg-chart-1 absolute inset-y-0 left-0 rounded-sm"
          :style="{ width: `${(bar.devices / widest) * 100}%` }"
        />
      </span>
      <span class="text-muted-foreground text-right font-mono tabular">
        {{ formatCount(bar.devices) }} · {{ formatPercent(bar.devices / total) }}
      </span>
    </li>
  </ul>
</template>
