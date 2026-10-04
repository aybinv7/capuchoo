<script setup lang="ts">
import { ChartColumn } from "@lucide/vue";
import { computed, watch } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import StackedBars from "@/shared/components/charts/StackedBars.vue";
import type { BarSeries } from "@/shared/components/charts/types";
import StatTile from "@/shared/components/StatTile.vue";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { useAppStats } from "@/shared/queries/useAppStats";
import { fillDays } from "../lib/series";
import ChannelHealthTable from "./ChannelHealthTable.vue";
import VersionDistribution from "./VersionDistribution.vue";

const props = defineProps<{ appId: string; days: number }>();
const emit = defineEmits<{ busy: [busy: boolean] }>();

const { data, isPending, isFetching, error, refetch } = useAppStats(
  () => props.appId,
  () => props.days,
);
watch(isFetching, (busy) => emit("busy", busy), { immediate: true });

const daily = computed(() => fillDays(data.value?.daily ?? [], props.days, Date.now()));
const dayLabels = computed(() => daily.value.map((row) => row.day));

const OUTCOMES: BarSeries[] = [
  { key: "installs", label: "Installs", color: "var(--success)" },
  { key: "failures", label: "Failures", color: "var(--destructive)" },
];
const CHECKS: BarSeries[] = [{ key: "checks", label: "Update checks", color: "var(--chart-1)" }];

const outcomeValues = computed(() => ({
  installs: daily.value.map((row) => row.installs),
  failures: daily.value.map((row) => row.failures),
}));
const checkValues = computed(() => ({ checks: daily.value.map((row) => row.checks) }));
const totals = computed(() => data.value?.totals ?? null);
const hasActivity = computed(
  () => (data.value?.daily.length ?? 0) > 0 || (totals.value?.devices ?? 0) > 0,
);
</script>

<template>
  <ErrorNotice v-if="error" :error="error" :retry="refetch" />
  <div v-else-if="isPending" class="space-y-4">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-6">
      <Skeleton v-for="index in 6" :key="index" class="h-20" />
    </div>
    <Skeleton class="h-64 w-full" />
  </div>
  <EmptyState
    v-else-if="!hasActivity"
    :icon="ChartColumn"
    title="No telemetry yet"
    description="Devices report checks and installs once an app using @capuchoo/updater points at this server."
  />
  <div v-else-if="totals" class="space-y-6">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Devices" :value="formatCount(totals.devices)" hint="assigned to a channel" />
      <StatTile label="Active 24h" :value="formatCount(totals.active_24h)" />
      <StatTile
        label="Update checks"
        :value="formatCount(totals.checks)"
        :hint="`last ${props.days} days`"
      />
      <StatTile
        label="Installs"
        :value="formatCount(totals.installs)"
        tone="success"
        :hint="`last ${props.days} days`"
      />
      <StatTile
        label="Failures"
        :value="formatCount(totals.failures)"
        :tone="totals.failures ? 'danger' : 'default'"
        :hint="`last ${props.days} days`"
      />
      <StatTile
        label="Install success"
        :value="formatPercent(totals.success_rate)"
        hint="installs / (installs + failures)"
      />
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="bg-card rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">Installs and failures per day</h2>
        <StackedBars
          :buckets="dayLabels"
          :series="OUTCOMES"
          :values="outcomeValues"
          label="Installs and failures per day"
        />
      </section>
      <section class="bg-card rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">Update checks per day</h2>
        <StackedBars
          :buckets="dayLabels"
          :series="CHECKS"
          :values="checkValues"
          label="Update checks per day"
        />
      </section>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section class="bg-card rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">Running versions</h2>
        <VersionDistribution :versions="data?.versions ?? []" />
      </section>
      <section class="space-y-3">
        <h2 class="text-sm font-medium">Channel health</h2>
        <ChannelHealthTable :channels="data?.channels ?? []" />
      </section>
    </div>
  </div>
</template>
