<template>
  <F7Page class="cap-page">
    <F7Navbar large :title="t('channels.title')" class="navbar-gradient">
      <template #left><AppSwitchButton /></template>
      <template #right><TopBarActions /></template>
    </F7Navbar>

    <template #fixed>
      <PullToRefresh :tables="[]" :action="refreshAll" />
    </template>

    <div v-if="!release" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <EmptyState
      v-else-if="!release.channels.length"
      icon="layers"
      shape="clover4"
      :title="t('channels.emptyTitle')"
      :text="t('channels.emptyText')"
    />

    <template v-else>
      <template v-for="group in groups" :key="group.kind">
        <F7BlockTitle>{{ t(`channels.${group.kind}`) }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <ChannelListItem
            v-for="view in group.views"
            :key="view.channel.id"
            :view="view"
            :href="`/channels/${view.channel.id}/`"
            :health="healthOf(view.channel.id)"
          />
        </F7List>
      </template>
      <F7BlockFooter>{{ t(`roles.purpose.${release.app.role}`) }}</F7BlockFooter>
    </template>
  </F7Page>
</template>

<script setup lang="ts">
import EmptyState from "@/shared/components/app/EmptyState.vue";
import AppSwitchButton from "@/shared/components/navigation/AppSwitchButton.vue";
import TopBarActions from "@/shared/components/navigation/TopBarActions.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import ChannelListItem from "@/shared/components/release/ChannelListItem.vue";
import { useAppStats } from "@/shared/composables/insights/useAppStats";
import { useAppRelease } from "@/shared/composables/release/useAppRelease";
import { DEFAULT_WINDOW } from "@/shared/sync/insights";

/** The app's channels: release lanes in promotion order, then the client channels that follow them. */
const { t } = useI18n();
const { release, refresh } = useAppRelease();
const { stats, fetch } = useAppStats(ref(DEFAULT_WINDOW));

const groups = computed(() => {
  const views = release.value?.channels ?? [];
  return (["release", "client"] as const)
    .map((kind) => ({ kind, views: views.filter((view) => view.channel.kind === kind) }))
    .filter((group) => group.views.length > 0);
});

const healthById = computed(
  () => new Map((stats.value?.channels ?? []).map((row) => [row.channel_id, row])),
);

function healthOf(channelId: string) {
  return healthById.value.get(channelId) ?? null;
}

async function refreshAll(): Promise<void> {
  await Promise.allSettled([refresh(), fetch(true)]);
}
</script>
