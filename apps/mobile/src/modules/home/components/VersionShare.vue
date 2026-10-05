<template>
  <div class="version-card">
    <F7PieChart :datasets="datasets" :size="132" tooltip class="shrink-0" />
    <ul class="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0">
      <li v-for="(slice, index) in slices" :key="slice.version" class="flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: palette[index] }" />
        <span class="cap-mono min-w-0 flex-1 truncate text-sm font-semibold">{{
          slice.version
        }}</span>
        <span class="text-xs text-muted-foreground tabular-nums">{{
          formatPercent(slice.share)
        }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useCssColors } from "@/shared/composables/theme/useCssColors";
import { formatPercent } from "@/shared/utils/format";
import type { VersionSlice } from "../lib/series";

/** Which versions the fleet runs, as Framework7's pie with a legend that names each slice. */
const props = defineProps<{ slices: VersionSlice[] }>();

const tones = useCssColors({
  a: "--primary",
  b: "--tertiary",
  c: "--tone-2",
  d: "--tone-4",
  e: "--tone-5",
  f: "--muted-foreground",
});

const palette = computed(() => Object.values(tones.value));

const datasets = computed(() =>
  props.slices.map((slice, index) => ({
    value: slice.devices,
    color: palette.value[index % palette.value.length],
    label: slice.version,
  })),
);
</script>

<style scoped>
.version-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  border-radius: var(--radius-xl);
  background: var(--card);
}
</style>
