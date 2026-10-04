<script setup lang="ts">
import { ArrowRight, Clapperboard, Package } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import StackedBars from "@/shared/components/charts/StackedBars.vue";
import type { BarSeries } from "@/shared/components/charts/types";
import TopIssues from "@/shared/components/recording/TopIssues.vue";
import VersionQuality from "@/shared/components/recording/VersionQuality.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { fillDays } from "@/shared/lib/days";
import { formatCount, formatPercent } from "@/shared/lib/format";
import { useAppStats } from "@/shared/queries/useAppStats";
import { useLatestSessions } from "@/shared/queries/useLatestSessions";
import { useRecordingStats } from "@/shared/queries/useRecordingStats";
import { versionSpike } from "@/shared/recording/quality";
import { RouteName } from "@/shared/router/route-names";
import type { RecordingDay } from "@/shared/types/recording-stats";
import type { DailyActivity } from "@/shared/types/stats";
import AttentionList from "../components/AttentionList.vue";
import LatestSessions from "../components/LatestSessions.vue";
import PillarCard, { type PillarMetric } from "../components/PillarCard.vue";
import RecorderStatus from "../components/RecorderStatus.vue";
import { attentionItems } from "../lib/attention";

/** Recordings are kept 14 days, so the overview never asks for more. */
const WINDOWS = [7, 14] as const;
type Window = (typeof WINDOWS)[number];

const { appId, app } = useCurrentApp();
const days = ref<Window>(14);

const delivery = useAppStats(appId, days);
const recording = useRecordingStats(appId, days);
const latest = useLatestSessions(appId, { limit: 6 });

const deliveryDays = computed(() =>
  fillDays<DailyActivity>(delivery.data.value?.daily ?? [], days.value, Date.now(), (day) => ({
    day,
    checks: 0,
    installs: 0,
    failures: 0,
    devices: 0,
  })),
);
const recordingDays = computed(() =>
  fillDays<RecordingDay>(recording.data.value?.daily ?? [], days.value, Date.now(), (day) => ({
    day,
    sessions: 0,
    error_sessions: 0,
    devices: 0,
    bytes: 0,
  })),
);

const OUTCOMES: BarSeries[] = [
  { key: "installs", label: "Installs", color: "var(--success)" },
  { key: "failures", label: "Failures", color: "var(--destructive)" },
];
const SESSIONS: BarSeries[] = [
  { key: "clean", label: "Without errors", color: "var(--chart-2)" },
  { key: "errors", label: "With errors", color: "var(--destructive)" },
];

const outcomeValues = computed(() => ({
  installs: deliveryDays.value.map((row) => row.installs),
  failures: deliveryDays.value.map((row) => row.failures),
}));
const sessionValues = computed(() => ({
  clean: recordingDays.value.map((row) => row.sessions - row.error_sessions),
  errors: recordingDays.value.map((row) => row.error_sessions),
}));

const deliveryTotals = computed(() => delivery.data.value?.totals ?? null);
const recordingTotals = computed(() => recording.data.value?.totals ?? null);
const issues = computed(() => recording.data.value?.issues ?? null);

const hasTelemetry = computed(
  () => (delivery.data.value?.daily.length ?? 0) > 0 || (deliveryTotals.value?.devices ?? 0) > 0,
);
const recordingConnected = computed(() => {
  const stats = recording.data.value;
  return Boolean(stats && (stats.totals.sessions > 0 || stats.recorders.total > 0));
});

const successTone = computed(() => {
  const rate = deliveryTotals.value?.success_rate;
  if (rate === null || rate === undefined) return "default" as const;
  if (rate >= 0.97) return "success" as const;
  return rate >= 0.9 ? ("warning" as const) : ("danger" as const);
});

const deliveryMetrics = computed<PillarMetric[]>(() => {
  const totals = deliveryTotals.value;
  return [
    { label: "Installs", value: formatCount(totals?.installs), tone: "success" },
    {
      label: "Failures",
      value: formatCount(totals?.failures),
      tone: totals?.failures ? "danger" : "default",
    },
    { label: "Active 24h", value: formatCount(totals?.active_24h) },
  ];
});

const unresolved = computed(() => (issues.value ? issues.value.open + issues.value.regressed : 0));
const errorsTone = computed(() => {
  if (!issues.value) return "default" as const;
  if (issues.value.regressed > 0) return "danger" as const;
  return unresolved.value > 0 ? ("warning" as const) : ("success" as const);
});
const errorsLabel = computed(() => {
  const regressed = issues.value?.regressed ?? 0;
  return regressed > 0
    ? `unresolved errors · ${regressed} came back after a fix`
    : "unresolved errors in recorded sessions";
});

const recordingMetrics = computed<PillarMetric[]>(() => {
  const totals = recordingTotals.value;
  return [
    { label: "Sessions", value: formatCount(totals?.sessions) },
    {
      label: "With errors",
      value: formatCount(totals?.error_sessions),
      tone: totals?.error_sessions ? "danger" : "default",
    },
    { label: "User reports", value: formatCount(totals?.reports) },
  ];
});

const spike = computed(() => versionSpike(recording.data.value?.versions ?? []));
const attention = computed(() => attentionItems(delivery.data.value, recording.data.value));
const loadingAttention = computed(() => delivery.isPending.value || recording.isPending.value);

function setDays(value: unknown) {
  const next = Number(value);
  if ((WINDOWS as readonly number[]).includes(next)) days.value = next as Window;
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Overview"
      :description="`How ${app?.name ?? 'this app'} reaches its devices, and how it behaves once it runs there.`"
    >
      <template #actions>
        <ToggleGroup
          :model-value="String(days)"
          type="single"
          variant="outline"
          size="sm"
          :class="(delivery.isFetching.value || recording.isFetching.value) && 'opacity-70'"
          @update:model-value="setDays"
        >
          <ToggleGroupItem v-for="span in WINDOWS" :key="span" :value="String(span)"
            >{{ span }} days</ToggleGroupItem
          >
        </ToggleGroup>
      </template>
    </PageHeader>

    <div class="grid gap-4 xl:grid-cols-2">
      <ErrorNotice
        v-if="delivery.error.value && !delivery.data.value"
        :error="delivery.error.value"
        :retry="delivery.refetch"
      />
      <PillarCard
        v-else
        title="Delivery"
        :icon="Package"
        :headline="formatPercent(deliveryTotals?.success_rate)"
        :headline-label="`install success, last ${days} days`"
        :tone="successTone"
        :metrics="deliveryMetrics"
        :loading="delivery.isPending.value"
      >
        <template #links>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: RouteName.canvas }">Canvas</RouterLink>
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: RouteName.statistics }">Statistics</RouterLink>
          </Button>
        </template>
        <template #chart>
          <StackedBars
            v-if="hasTelemetry"
            :buckets="deliveryDays.map((row) => row.day)"
            :series="OUTCOMES"
            :values="outcomeValues"
            :height="168"
            label="Installs and failures per day"
          />
          <p v-else class="text-muted-foreground flex h-full items-center text-sm">
            Devices report installs once an app using @capuchoo/updater checks in.
          </p>
        </template>
      </PillarCard>

      <ErrorNotice
        v-if="recording.error.value && !recording.data.value"
        :error="recording.error.value"
        :retry="recording.refetch"
      />
      <PillarCard
        v-else
        title="Sessions"
        :icon="Clapperboard"
        :headline="formatCount(unresolved)"
        :headline-label="errorsLabel"
        :tone="errorsTone"
        :metrics="recordingMetrics"
        :loading="recording.isPending.value"
      >
        <template #links>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: RouteName.recordings }">Sessions</RouterLink>
          </Button>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: RouteName.recordingIssues }">Errors</RouterLink>
          </Button>
        </template>
        <template #chart>
          <StackedBars
            v-if="recordingConnected"
            :buckets="recordingDays.map((row) => row.day)"
            :series="SESSIONS"
            :values="sessionValues"
            :height="168"
            label="Recorded sessions per day"
          />
          <div v-else class="flex h-full flex-col items-start justify-center gap-3">
            <p class="text-muted-foreground text-sm">
              No device records yet. Add the recorder and an error, a shake or a report uploads the
              minutes that led up to it.
            </p>
            <Button size="sm" as-child>
              <RouterLink :to="{ name: RouteName.recordingSetup }">
                Connect the recorder
                <ArrowRight />
              </RouterLink>
            </Button>
          </div>
        </template>
      </PillarCard>
    </div>

    <AttentionList :items="attention" :loading="loadingAttention" />

    <div v-if="recordingConnected" class="grid gap-4 xl:grid-cols-2">
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <header class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Errors hitting the most sessions</h2>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" as-child>
            <RouterLink :to="{ name: RouteName.recordingIssues }">All errors</RouterLink>
          </Button>
        </header>
        <TopIssues :issues="issues?.top ?? []" :days="days" :loading="recording.isPending.value" />
      </section>
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <header class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Sessions with errors, by version</h2>
          <span class="text-muted-foreground text-xs">newest first</span>
        </header>
        <VersionQuality
          :versions="recording.data.value?.versions ?? []"
          :spike="spike"
          :loading="recording.isPending.value"
        />
      </section>
    </div>

    <div v-if="recordingConnected" class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <header class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Latest sessions</h2>
          <Button variant="link" size="sm" class="h-auto p-0 text-xs" as-child>
            <RouterLink :to="{ name: RouteName.recordings }">All sessions</RouterLink>
          </Button>
        </header>
        <LatestSessions :sessions="latest.data.value ?? []" :loading="latest.isPending.value" />
      </section>
      <section class="bg-card min-w-0 rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-medium">Recorders</h2>
        <RecorderStatus :stats="recording.data.value" :loading="recording.isPending.value" />
      </section>
    </div>
  </PageContainer>
</template>
