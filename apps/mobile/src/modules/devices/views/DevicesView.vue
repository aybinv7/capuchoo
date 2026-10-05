<template>
  <F7Page class="cap-page" :class="{ 'cap-pushed': pushed }">
    <F7Navbar
      :large="!pushed"
      :title="pushed && channelName ? channelName : t('devices.title')"
      :back-link="pushed"
      class="navbar-gradient"
    >
      <template v-if="!pushed" #left><AppSwitchButton /></template>
      <template v-if="!pushed" #right><TopBarActions /></template>
    </F7Navbar>

    <template #fixed>
      <PullToRefresh :tables="[]" :action="refresh" />
    </template>

    <div class="flex flex-col gap-3 px-4 pt-1">
      <F7Searchbar
        inline
        custom-search
        :outline="false"
        :backdrop="false"
        :disable-button="false"
        :placeholder="t('devices.search')"
        :value="search"
        @update:value="search = String($event ?? '')"
        @searchbar:clear="search = ''"
      />
      <div class="filter-chips" role="group">
        <F7Chip
          v-for="option in ACTIVITY"
          :key="option"
          :text="t(`devices.filter.${option}`)"
          :outline="activity !== option"
          :class="{ 'chip-selected': activity === option }"
          @click="setActivity(option)"
        />
        <template v-if="!pushed">
          <span class="chip-divider" aria-hidden="true" />
          <F7Chip
            v-for="channel in channelOptions"
            :key="channel.id"
            :text="channel.name"
            :outline="channelId !== channel.id"
            :class="{ 'chip-selected': channelId === channel.id }"
            @click="toggleChannel(channel.id)"
          />
        </template>
      </div>
    </div>

    <div v-if="loading && !all.length" class="grid place-items-center py-16">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <template v-else-if="devices.length">
      <F7BlockTitle>{{ countLabel }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <DeviceListItem v-for="device in visible" :key="device.id" :device="device" />
        <F7ListButton v-if="devices.length > limit" @click="limit += PAGE">
          {{ t("devices.more", { count: devices.length - limit }) }}
        </F7ListButton>
      </F7List>
      <F7BlockFooter v-if="truncated">{{
        t("devices.truncated", { shown: all.length, total: release?.app.device_count ?? 0 })
      }}</F7BlockFooter>
    </template>

    <EmptyState
      v-else
      :icon="filtering ? 'search_off' : 'devices'"
      shape="pentagon"
      :title="filtering ? t('devices.noMatch') : t('devices.emptyTitle')"
      :text="filtering ? undefined : (error ?? t('devices.emptyText'))"
    >
      <F7Button v-if="filtering" tonal round class="w-auto! px-6!" @click="clearFilters">{{
        t("devices.clearFilters")
      }}</F7Button>
    </EmptyState>
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import AppSwitchButton from "@/shared/components/navigation/AppSwitchButton.vue";
import TopBarActions from "@/shared/components/navigation/TopBarActions.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import { useAppRelease } from "@/shared/composables/release/useAppRelease";
import { tick } from "@/shared/utils/native/haptics";
import DeviceListItem from "../components/DeviceListItem.vue";
import { useDevices, type ActivityFilter } from "../composables/useDevices";

/**
 * The phones running the app, most recently seen first. Opened from a channel it is that
 * channel's fleet, pushed with a back arrow; as a tab it is every device.
 */
const PAGE = 50;
const ACTIVITY: readonly ActivityFilter[] = ["all", "active", "idle"];

const props = defineProps<{ f7route: Router.Route; f7router: Router.Router }>();
const initialChannel = props.f7route.query.channel ? String(props.f7route.query.channel) : null;
const pushed = initialChannel !== null;
if (pushed) useHiddenTabbar();

const { t } = useI18n();
const { release } = useAppRelease();
const { all, devices, loading, search, channelId, activity, error, refresh } =
  useDevices(initialChannel);

const limit = ref(PAGE);
watch([search, channelId, activity], () => (limit.value = PAGE));
const visible = computed(() => devices.value.slice(0, limit.value));

const channelOptions = computed(() => {
  const used = new Set(all.value.map((device) => device.channel_id).filter(Boolean));
  return (release.value?.channels ?? [])
    .map((view) => view.channel)
    .filter((channel) => used.has(channel.id));
});
const channelName = computed(
  () => channelOptions.value.find((channel) => channel.id === initialChannel)?.name ?? "",
);

const filtering = computed(
  () =>
    Boolean(search.value.trim()) ||
    activity.value !== "all" ||
    (!pushed && Boolean(channelId.value)),
);
const truncated = computed(() => (release.value?.app.device_count ?? 0) > all.value.length);
const countLabel = computed(() =>
  filtering.value
    ? t("devices.matching", { count: devices.value.length }, devices.value.length)
    : t("devices.count", { count: devices.value.length }, devices.value.length),
);

function setActivity(option: ActivityFilter): void {
  if (option === activity.value) return;
  tick();
  activity.value = option;
}

function toggleChannel(id: string): void {
  tick();
  channelId.value = channelId.value === id ? null : id;
}

function clearFilters(): void {
  search.value = "";
  activity.value = "all";
  if (!pushed) channelId.value = null;
}
</script>

<style scoped>
.filter-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-inline: -16px;
  padding-inline: 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-chips :deep(.chip) {
  flex-shrink: 0;
}

.filter-chips :deep(.chip-selected) {
  --f7-chip-bg-color: var(--secondary);
  --f7-chip-text-color: var(--secondary-foreground);
}

.chip-divider {
  flex-shrink: 0;
  width: 1px;
  height: 20px;
  background: var(--divider);
}
</style>
