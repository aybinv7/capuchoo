<script setup lang="ts">
import { Clapperboard } from "@lucide/vue";
import { computed, watch } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import StackedBars from "@/shared/components/charts/StackedBars.vue";
import type { BarSeries } from "@/shared/components/charts/types";
import TopIssues from "@/shared/components/recording/TopIssues.vue";
import VersionQuality from "@/shared/components/recording/VersionQuality.vue";
import StatTile from "@/shared/components/StatTile.vue";
import { fillDays } from "@/shared/lib/days";
import { formatBytes, formatCount, formatPercent, formatSpan } from "@/shared/lib/format";
import { useRecordingStats } from "@/shared/queries/useRecordingStats";
import { versionSpike } from "@/shared/recording/quality";
import { RouteName } from "@/shared/router/route-names";
import type { RecordingDay } from "@/shared/types/recording-stats";
import SessionStarts from "./SessionStarts.vue";

const props = defineProps<{ appId: string; days: number }>();
const emit = defineEmits<{ busy: [busy: boolean] }>();

const { data, isPending, isFetching, error, refetch } = useRecordingStats(
  () => props.appId,
  () => props.days,
);
watch(isFetching, (busy) => emit("busy", busy), { immediate: true });

const daily = computed(() =>
  fillDays<RecordingDay>(data.value?.daily ?? [], props.days, Date.now(), (day) => ({
    day,
    sessions: 0,
    error_sessions: 0,
    devices: 0,
    bytes: 0,
  })),
);
const dayLabels = computed(() => daily.value.map((row) => row.day));

const SESSIONS: BarSeries[] = [
  { key: "clean", label: "Without errors", color: "var(--chart-2)" },
  { key: "errors", label: "With errors", color: "var(--destructive)" },
];
const DEVICES: BarSeries[] = [{ key: "devices", label: "Devices", color: "var(--chart-1)" }];

const sessionValues = computed(() => ({
  clean: daily.value.map((row) => row.sessions - row.error_sessions),
  errors: daily.value.map((row) => row.error_sessions),
}));
const deviceValues = computed(() => ({ devices: daily.value.map((row) => row.devices) }));

const totals = computed(() => data.value?.totals ?? null);
const issues = computed(() => data.value?.issues ?? null);
const spike = computed(() => versionSpike(data.value?.versions ?? []));
const empty = computed(
  () =>
    data.value !== undefined &&
    data.value.totals.sessions === 0 &&
    data.value.recorders.total === 0,
);
const errorFree = computed(() =>
  totals.value?.error_rate === null || totals.value?.error_rate === undefined
    ? null
    : 1 - totals.value.error_rate,
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
    v-else-if="empty"
    :icon="Clapperboard"
    title="No recordings yet"
    description="Connect the recorder and an error, a shake or a report from any device uploads what led up to it. Sessions are kept 14 days."
  >
    <Button size="sm" as-child>
      <RouterLink :to="{ name: RouteName.recordingSetup }">Connect an app</RouterLink>
    </Button>
  </EmptyState>
  <div v-else-if="totals && issues" class="space-y-6">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <StatTile
        label="Sessions"
        :value="formatCount(totals.sessions)"
        :hint="`on ${formatCount(totals.devices)} devices`"
      />
      <StatTile
        label="Error-free sessions"
        :value="formatPercent(errorFree)"
        :hint="`${formatCount(totals.error_sessions)} saw an error`"
      />
      <StatTile
        label="Unresolved errors"
        :value="formatCount(issues.open + issues.regressed)"
        :tone="issues.regressed > 0 ? 'danger' : 'default'"
        :hint="
          issues.regressed > 0
            ? `${issues.regressed} came back · ${issues.new} new`
            : `${issues.new} new in ${props.days} days`
        "
      />
      <StatTile
        label="User reports"
        :value="formatCount(totals.reports)"
        hint="shake or report, with a note"
      />
      <StatTile
        label="Average session"
        :value="formatSpan(totals.avg_duration_ms)"
        :hint="`${formatSpan(totals.duration_ms)} in all`"
      />
      <StatTile
        label="Stored"
        :value="formatBytes(totals.bytes)"
        :hint="`kept 14 days · last ${props.days} shown`"
      />
    </div>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="bg-card rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">Sessions per day</h2>
        <StackedBars
          :buckets="dayLabels"
          :series="SESSIONS"
          :values="sessionValues"
          label="Recorded sessions per day, with and without errors"
        />
      </section>
      <section class="bg-card rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">Devices recorded per day</h2>
        <StackedBars
          :buckets="dayLabels"
          :series="DEVICES"
          :values="deviceValues"
          label="Devices that recorded a session, per day"
        />
      </section>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">What started them</h2>
        <SessionStarts :starts="data?.starts ?? []" />
      </section>
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <h2 class="mb-1 text-sm font-medium">Sessions with errors, by version</h2>
        <p class="text-muted-foreground mb-2 text-xs">
          Highest version first; red when it breaks more often than the ones before it.
        </p>
        <VersionQuality :versions="data?.versions ?? []" :spike="spike" />
      </section>
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <header class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Errors hitting the most sessions</h2>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" as-child>
            <RouterLink :to="{ name: RouteName.recordingIssues }">All errors</RouterLink>
          </Button>
        </header>
        <TopIssues :issues="issues.top" :days="props.days" />
      </section>
    </div>
  </div>
</template>
