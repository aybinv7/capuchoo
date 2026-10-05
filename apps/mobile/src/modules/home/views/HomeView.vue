<template>
  <F7Page class="cap-page">
    <F7Navbar large :title="release?.app.name ?? ''" class="navbar-gradient">
      <template #left><AppSwitchButton /></template>
      <template #right><TopBarActions /></template>
    </F7Navbar>

    <template #fixed>
      <PullToRefresh :tables="[]" :action="refreshAll" />
    </template>

    <div v-if="!release" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <template v-else>
      <div class="px-4 pt-1">
        <PhoneCard
          :status="release.phone"
          :can-install="phone.canInstall.value"
          :job="phone.job.value"
          @install="phone.installTarget"
          @cancel="phone.cancelTarget"
          @open="phone.openOnPhone"
        />
      </div>

      <template v-if="lanes.length">
        <F7BlockTitle>{{ t("home.lanes") }}</F7BlockTitle>
        <LaneStrip :lanes="lanes" />
      </template>

      <div class="mt-8 mb-3 flex items-center justify-between gap-3 px-4">
        <h2 class="m-0 text-[22px] leading-7 font-semibold tracking-tight">
          {{ t("home.fleet") }}
        </h2>
        <F7Segmented strong round class="window-picker" :class="{ 'opacity-70': fetching }">
          <F7Button
            v-for="span in STAT_WINDOWS"
            :key="span"
            small
            :active="days === span"
            @click="setDays(span)"
            >{{ t("home.days", { count: span }) }}</F7Button
          >
        </F7Segmented>
      </div>

      <div v-if="!stats && (loading || fetching)" class="grid place-items-center py-12">
        <LoadingIndicator contained :size="48" :label="t('home.loadingStats')" />
      </div>

      <EmptyState
        v-else-if="!stats || !hasTelemetry"
        icon="query_stats"
        shape="flower"
        :title="statsError && !stats ? t('home.statsFailed') : t('home.noTelemetryTitle')"
        :text="statsError && !stats ? statsError : t('home.noTelemetryText')"
      >
        <F7Button v-if="statsError" tonal round class="w-auto! px-6!" @click="fetch(true)">{{
          t("common.refresh")
        }}</F7Button>
      </EmptyState>

      <div v-else class="flex flex-col gap-2 px-4">
        <SuccessGauge
          :rate="stats.totals.success_rate"
          :installs="stats.totals.installs"
          :failures="stats.totals.failures"
        />
        <div class="grid grid-cols-2 gap-2">
          <StatTile
            icon="devices"
            shape="cookie9"
            :value="formatCount(stats.totals.devices, locale)"
            :label="t('home.devices')"
          />
          <StatTile
            icon="bolt"
            shape="sunny"
            tone="bg-tertiary text-tertiary-foreground"
            :value="formatCount(stats.totals.active_24h, locale)"
            :label="t('home.active')"
          />
          <StatTile
            icon="sync"
            shape="pill"
            tone="bg-primary-container text-primary-container-foreground"
            :value="formatCount(stats.totals.checks, locale)"
            :label="t('home.checks')"
            class="col-span-2"
          />
        </div>
        <DailyChart
          :title="t('home.outcomesTitle')"
          :caption="t('home.days', { count: days })"
          :days="dayLabels"
          :series="outcomeSeries"
        />
        <VersionShare v-if="slices.length" :slices="slices" />
      </div>

      <template v-if="stats?.channels.length">
        <F7BlockTitle>{{ t("home.healthTitle") }}</F7BlockTitle>
        <ChannelHealthList :channels="stats.channels" />
      </template>

      <template v-if="recent.length">
        <F7BlockTitle>{{ t("home.recent") }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <ActivityListItem
            v-for="row in recent"
            :key="row.id"
            :row="row"
            :app-name="release.app.name"
          />
          <F7ListButton href="/activity/">{{ t("home.allActivity") }}</F7ListButton>
        </F7List>
      </template>

      <F7BlockFooter v-if="syncedAt">{{
        t("home.updated", { when: formatRelative(syncedAt, locale) })
      }}</F7BlockFooter>
    </template>
  </F7Page>
</template>

<script setup lang="ts">
import ActivityListItem from "@/shared/components/app/ActivityListItem.vue";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import AppSwitchButton from "@/shared/components/navigation/AppSwitchButton.vue";
import TopBarActions from "@/shared/components/navigation/TopBarActions.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import PhoneCard from "@/shared/components/release/PhoneCard.vue";
import { useAppRelease } from "@/shared/composables/release/useAppRelease";
import { useCssColors } from "@/shared/composables/theme/useCssColors";
import { releaseLanes } from "@/shared/release/lanes";
import { DEFAULT_WINDOW, STAT_WINDOWS, syncDevices, type StatWindow } from "@/shared/sync/insights";
import { formatCount, formatRelative } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";
import ChannelHealthList from "../components/ChannelHealthList.vue";
import DailyChart from "../components/DailyChart.vue";
import LaneStrip from "../components/LaneStrip.vue";
import StatTile from "../components/StatTile.vue";
import SuccessGauge from "../components/SuccessGauge.vue";
import VersionShare from "../components/VersionShare.vue";
import { useAppStats } from "@/shared/composables/insights/useAppStats";
import { usePhoneActions } from "@/shared/composables/release/usePhoneActions";
import { fillDays, versionSlices } from "../lib/series";

/**
 * The app at a glance, as the web dashboard's statistics page reads on a phone: this phone first,
 * then where each release stands, then how the fleet is taking it.
 */
const RECENT = 3;
const VERSION_SLICES = 6;

const { t, locale } = useI18n();
const { release, refresh } = useAppRelease();
const phone = usePhoneActions(release);

const days = ref<StatWindow>(DEFAULT_WINDOW);
const { stats, syncedAt, loading, fetching, error: statsError, fetch } = useAppStats(days);

const lanes = computed(() =>
  release.value
    ? releaseLanes(
        release.value.channels.map((view) => view.channel),
        release.value.natives,
      )
    : [],
);
const recent = computed(() => release.value?.activity.slice(0, RECENT) ?? []);

const hasTelemetry = computed(
  () => (stats.value?.daily.length ?? 0) > 0 || (stats.value?.totals.devices ?? 0) > 0,
);
const daily = computed(() => fillDays(stats.value?.daily ?? [], days.value, Date.now()));
const dayLabels = computed(() => daily.value.map((row) => row.day));

const colors = useCssColors({ installs: "--env-prod", failures: "--destructive" });
const outcomeSeries = computed(() => [
  {
    label: t("home.installs"),
    color: colors.value.installs,
    values: daily.value.map((row) => row.installs),
  },
  {
    label: t("home.failures"),
    color: colors.value.failures,
    values: daily.value.map((row) => row.failures),
  },
]);

const slices = computed(() =>
  versionSlices(stats.value?.versions ?? [], VERSION_SLICES, (count) =>
    t("home.otherVersions", { count }, count),
  ),
);

function setDays(span: StatWindow): void {
  if (span === days.value) return;
  tick();
  days.value = span;
}

async function refreshAll(): Promise<void> {
  const appId = release.value?.app.id;
  await Promise.allSettled([refresh(), fetch(true), appId ? syncDevices(appId) : 0]);
}
</script>

<style scoped>
.window-picker {
  width: auto;
  flex-shrink: 0;
}
</style>
