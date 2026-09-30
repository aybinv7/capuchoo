<script setup lang="ts">
import { ChartColumn } from "@lucide/vue";
import { computed, ref } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { useAppStats } from "@/shared/queries/useAppStats";
import ChannelHealthTable from "../components/ChannelHealthTable.vue";
import StackedDailyBars from "../components/StackedDailyBars.vue";
import StatTile from "../components/StatTile.vue";
import VersionDistribution from "../components/VersionDistribution.vue";
import { fillDays } from "../lib/series";
import { STAT_WINDOWS, type BarSeries, type StatWindow } from "../types/statistics.types";

const { appId } = useCurrentApp();
const days = ref<StatWindow>(30);
const { data, isPending, isFetching, error, refetch } = useAppStats(appId, days);

const daily = computed(() => fillDays(data.value?.daily ?? [], days.value, Date.now()));
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

function setDays(value: unknown) {
  const next = Number(value);
  if ((STAT_WINDOWS as readonly number[]).includes(next)) days.value = next as StatWindow;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Statistics"
      description="Update checks, installs and failures reported by devices, and how far each channel's fleet has moved to its current bundle."
    >
      <template #actions>
        <ToggleGroup
          :model-value="String(days)"
          type="single"
          variant="outline"
          size="sm"
          :class="isFetching && 'opacity-70'"
          @update:model-value="setDays"
        >
          <ToggleGroupItem v-for="span in STAT_WINDOWS" :key="span" :value="String(span)"
            >{{ span }} days</ToggleGroupItem
          >
        </ToggleGroup>
      </template>
    </PageHeader>

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
    <template v-else-if="totals">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Devices"
          :value="formatCount(totals.devices)"
          hint="assigned to a channel"
        />
        <StatTile label="Active 24h" :value="formatCount(totals.active_24h)" />
        <StatTile
          label="Update checks"
          :value="formatCount(totals.checks)"
          :hint="`last ${days} days`"
        />
        <StatTile
          label="Installs"
          :value="formatCount(totals.installs)"
          tone="success"
          :hint="`last ${days} days`"
        />
        <StatTile
          label="Failures"
          :value="formatCount(totals.failures)"
          :tone="totals.failures ? 'danger' : 'default'"
          :hint="`last ${days} days`"
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
          <StackedDailyBars
            :days="dayLabels"
            :series="OUTCOMES"
            :values="outcomeValues"
            label="Installs and failures per day"
          />
        </section>
        <section class="bg-card rounded-lg border p-4">
          <h2 class="mb-3 text-sm font-medium">Update checks per day</h2>
          <StackedDailyBars
            :days="dayLabels"
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
    </template>
  </PageContainer>
</template>
