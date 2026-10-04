<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import DonutChart from "@/shared/components/charts/DonutChart.vue";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { startStyle } from "@/shared/recording/start";
import { RouteName } from "@/shared/router/route-names";

const props = defineProps<{ starts: ReadonlyArray<{ start: string; sessions: number }> }>();

const active = ref<string | null>(null);
const total = computed(() => props.starts.reduce((sum, row) => sum + row.sessions, 0));
const rows = computed(() =>
  props.starts.map((row) => ({
    ...row,
    style: startStyle(row.start),
    share: total.value > 0 ? row.sessions / total.value : 0,
  })),
);
const segments = computed(() =>
  rows.value.map((row) => ({ key: row.start, value: row.sessions, color: row.style.color })),
);
const focused = computed(
  () => rows.value.find((row) => row.start === active.value) ?? rows.value[0] ?? null,
);
const label = computed(() =>
  rows.value.map((row) => `${row.style.label} ${formatPercent(row.share)}`).join(", "),
);
</script>

<template>
  <p v-if="rows.length === 0" class="text-muted-foreground py-6 text-sm">
    No session in this window.
  </p>
  <div v-else class="flex flex-col items-center gap-5 sm:flex-row">
    <DonutChart v-model:active="active" :segments="segments" :label="label" :size="132">
      <template v-if="focused">
        <span class="tabular block font-mono text-xl leading-none font-semibold">
          {{ formatPercent(focused.share) }}
        </span>
        <span class="text-muted-foreground mt-1 block max-w-24 truncate text-[11px]">
          {{ focused.style.label }}
        </span>
      </template>
    </DonutChart>
    <ul class="w-full min-w-0 flex-1 space-y-0.5">
      <li v-for="row in rows" :key="row.start">
        <RouterLink
          :to="{ name: RouteName.recordings, query: { start: row.start } }"
          class="hover:bg-accent/50 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-xs"
          :title="row.style.description"
          @mouseenter="active = row.start"
          @mouseleave="active = null"
          @focus="active = row.start"
          @blur="active = null"
        >
          <span class="size-2 rounded-full" :style="{ background: row.style.color }" />
          <span class="truncate">{{ row.style.label }}</span>
          <span class="tabular text-muted-foreground font-mono">{{
            formatCount(row.sessions)
          }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
