<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Statistics</h1>
        <p class="text-muted-foreground">Analytics overview for your apps</p>
      </div>
      <Select v-model="timeRange">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Last 24 hours</SelectItem>
          <SelectItem value="week">Last 7 days</SelectItem>
          <SelectItem value="month">Last 30 days</SelectItem>
          <SelectItem value="year">Last year</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Stats Cards -->
    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card v-for="i in 4" :key="i">
        <CardContent class="px-6 py-3">
          <div class="space-y-2">
            <Skeleton class="h-4 w-[100px]" />
            <Skeleton class="h-8 w-[60px]" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!--
      Every card opens the same dialog with a different slice. A modal rather
      than a route: the numbers are one app over one range, and navigating away
      would throw both away to show a breakdown table.
    -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card
        v-for="card in statsCards"
        :key="card.key"
        class="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        role="button"
        tabindex="0"
        :aria-label="`${card.title}: ${card.value}. Open details`"
        @click="openCard(card.key)"
        @keydown.enter.prevent="openCard(card.key)"
        @keydown.space.prevent="openCard(card.key)"
      >
        <CardContent class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-muted-foreground">{{ card.title }}</p>
              <p class="text-2xl font-bold tabular-nums">{{ card.value }}</p>
              <p class="text-xs text-muted-foreground">{{ card.caption }}</p>
            </div>
            <div :class="['p-3 rounded-full', card.bgColor]">
              <component :is="card.icon" class="h-6 w-6" :class="card.textColor" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Charts -->
    <div class="space-y-6">
      <UpdateDownloadsChart
        :data="downloadChartData"
        title="Update activity"
        description="Updates delivered and failed over time"
        class="w-full"
      />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChannelDistributionChart
          :data="channelDistributionData"
          title="Channel Distribution"
          description="Devices per channel"
        />
        <DeviceDistributionChart
          :data="deviceDistributionData"
          title="Platform Distribution"
          description="Events by platform"
        />
      </div>
    </div>

    <StatisticDetailDialog
      v-model:open="dialogOpen"
      :title="activeCard?.title ?? ''"
      :value="activeCard?.value ?? 0"
      :description="activeCard?.detail ?? ''"
      :rows="activeRows"
      :summary="statsData?.events"
      :empty-hint="activeCard?.emptyHint ?? 'Nothing recorded in this period yet.'"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Package, Smartphone, Download, TrendingUp } from "lucide-vue-next";
import {
  useDashboardStatsQuery,
  useDashboardStatsDataQuery,
  type StatsRange,
} from "@/modules/statistics/composables/useStatisticsQuery";
import type { ActionBreakdown } from "@/modules/statistics/types/statistics.types";

definePage({
  meta: {
    title: "Statistics - Capuchoo",
    description: "Analytics and metrics for your apps",
    category: "statistics",
  },
});

const timeRange = ref<StatsRange>("month");

const { data: statsData, isLoading } = useDashboardStatsQuery();
const { data: rangeData } = useDashboardStatsDataQuery(timeRange);

type CardKey = "bundles" | "devices" | "downloads" | "success";

/**
 * No invented deltas.
 *
 * Each card used to carry a hard-coded `change` - "+12% from last period",
 * "+24%" - printed in green beside a real number, which makes the real number
 * look computed too. There is no previous-period query, so there is no delta to
 * show, and a caption saying what the number *is* beats a trend that is a
 * literal in the source.
 */
const statsCards = computed(() => {
  const events = statsData.value?.events;
  const rate = statsData.value?.success_rate;

  return [
    {
      key: "bundles" as CardKey,
      title: "Total Updates",
      value: statsData.value?.bundles_count ?? 0,
      caption: "Bundles published",
      detail: "Every OTA bundle published for this app, across all channels.",
      emptyHint: "No bundles published yet. Publish one with a deploy.",
      icon: Package,
      bgColor: "bg-blue-100 dark:bg-blue-950",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      key: "devices" as CardKey,
      title: "Active Devices",
      value: statsData.value?.devices_count ?? 0,
      caption: "Seen at least once",
      detail: "Distinct devices that have reported to this app.",
      emptyHint: "No device has reported yet. One appears after its first update check.",
      icon: Smartphone,
      bgColor: "bg-green-100 dark:bg-green-950",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      key: "downloads" as CardKey,
      title: "Deliveries",
      value: statsData.value?.downloads_count ?? 0,
      caption: "Updates applied",
      detail: "Events where an artefact reached a device and was applied.",
      emptyHint: "No update applied yet. A check does not count - a device has to take one.",
      icon: Download,
      bgColor: "bg-purple-100 dark:bg-purple-950",
      textColor: "text-purple-600 dark:text-purple-400",
    },
    {
      key: "success" as CardKey,
      title: "Success Rate",
      // An em dash is "not known", and says so. This used to read 98.5%,
      // hard-coded, claiming a track record for an app that had shipped nothing.
      value: rate === null || rate === undefined ? "—" : `${rate}%`,
      caption:
        events && events.delivered + events.failed > 0
          ? `${events.delivered} of ${events.delivered + events.failed} attempts`
          : "No attempts yet",
      detail: "Deliveries as a share of attempts. Checks and lifecycle events are excluded.",
      emptyHint: "Nothing has been attempted, so there is no rate to report. This is not 100%.",
      icon: TrendingUp,
      bgColor: "bg-orange-100 dark:bg-orange-950",
      textColor: "text-orange-600 dark:text-orange-400",
    },
  ];
});

const dialogOpen = ref(false);
const activeKey = ref<CardKey | null>(null);

const activeCard = computed(() => statsCards.value.find((card) => card.key === activeKey.value));

/** The events behind the open card, or none for the counts that have no events. */
const activeRows = computed<ActionBreakdown[]>(() => {
  const rows = rangeData.value?.by_action ?? [];

  if (activeKey.value === "downloads") {
    return rows.filter((row) => row.category === "delivered");
  }
  if (activeKey.value === "success") {
    return rows.filter((row) => row.category === "delivered" || row.category === "failed");
  }
  if (activeKey.value === "devices") return rows;

  return [];
});

function openCard(key: CardKey): void {
  activeKey.value = key;
  dialogOpen.value = true;
}

const downloadChartData = computed(() => {
  const delivered = rangeData.value?.downloads ?? [];
  const failed = rangeData.value?.failures ?? [];
  const byDate = new Map<string, { date: string; delivered: number; failed: number }>();

  for (const point of delivered) {
    byDate.set(point.date, { date: point.date, delivered: point.count, failed: 0 });
  }
  for (const point of failed) {
    const existing = byDate.get(point.date);
    if (existing) existing.failed = point.count;
    else byDate.set(point.date, { date: point.date, delivered: 0, failed: point.count });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
});

const deviceDistributionData = computed(() =>
  (rangeData.value?.by_platform ?? []).map((row) => ({
    platform: row.platform,
    downloads: row.count,
  })),
);

const channelDistributionData = computed(() =>
  (rangeData.value?.by_channel ?? []).map((row, index) => ({
    channel: row.channel,
    count: row.count,
    fill: `var(--color-chart-${(index % 5) + 1})`,
  })),
);
</script>
