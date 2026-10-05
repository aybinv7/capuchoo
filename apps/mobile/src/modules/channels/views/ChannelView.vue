<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar :title="view?.channel.name ?? ''" back-link class="navbar-gradient" :sliding="true" />

    <template #fixed>
      <PullToRefresh :tables="[]" :action="refreshAll" />
    </template>

    <F7Toolbar v-if="view && allowed" bottom class="channel-actions">
      <div class="flex w-full gap-2 px-3">
        <F7Button
          fill
          round
          large
          class="flex-1 font-semibold!"
          :class="{ disabled: busy }"
          @click="delivering = view.channel"
        >
          <F7Icon md="material:rocket_launch" size="20" class="me-2" />
          {{ t("channel.deliverAction") }}
        </F7Button>
        <F7Button
          tonal
          round
          large
          class="flex-1 font-semibold!"
          :class="{ disabled: busy }"
          @click="actions.togglePause(view.channel)"
        >
          <F7Icon
            :md="view.channel.paused ? 'material:play_arrow' : 'material:pause'"
            size="20"
            class="me-2"
          />
          {{ view.channel.paused ? t("channel.resume") : t("channel.pause") }}
        </F7Button>
      </div>
    </F7Toolbar>

    <div v-if="!release" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <EmptyState
      v-else-if="!view"
      icon="layers_clear"
      :title="t('channels.goneTitle')"
      :text="t('channels.goneText')"
    />

    <template v-else>
      <ChannelHero :channel="view.channel" :base="view.base" />

      <F7BlockTitle>{{ t("channel.serving") }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <F7ListItem
          :link="view.native ? `/builds/${view.native.id}/` : false"
          :title="versionLabel(view.native?.version_name, view.native?.version_code)"
          :subtitle="
            view.native
              ? t('channel.nativeSince', { when: formatRelative(view.native.created_at, locale) })
              : t('channel.noNative')
          "
        >
          <template #media>
            <span
              class="grid size-10 place-items-center rounded-full bg-primary-container text-primary-container-foreground"
            >
              <F7Icon md="material:android" size="20" />
            </span>
          </template>
        </F7ListItem>
        <F7ListItem
          :title="view.bundle?.version_name ?? t('channel.noBundle')"
          :subtitle="
            view.bundle
              ? t('channel.bundleSince', { when: formatRelative(view.bundle.created_at, locale) })
              : t('channel.bundleHint')
          "
        >
          <template #media>
            <span
              class="grid size-10 place-items-center rounded-full bg-tertiary text-tertiary-foreground"
            >
              <F7Icon md="material:bolt" size="20" />
            </span>
          </template>
        </F7ListItem>
      </F7List>

      <template v-if="health">
        <F7BlockTitle>{{ t("channel.fleetTitle") }}</F7BlockTitle>
        <F7List strong inset dividers class="rounded-2xl!">
          <F7ListItem
            :title="t('channel.devices')"
            :after="String(health.devices)"
            :link="`/devices/?channel=${view.channel.id}`"
          >
            <template #media
              ><F7Icon md="material:devices" class="material-icons-outlined text-muted-foreground"
            /></template>
          </F7ListItem>
          <F7ListItem
            :title="t('channel.onCurrent')"
            :after="
              health.devices
                ? formatPercent(health.on_current / health.devices)
                : formatPercent(null)
            "
          >
            <template #media
              ><F7Icon md="material:verified" class="material-icons-outlined text-muted-foreground"
            /></template>
          </F7ListItem>
          <F7ListItem :title="t('channel.active')" :after="String(health.active_24h)">
            <template #media
              ><F7Icon md="material:bolt" class="material-icons-outlined text-muted-foreground"
            /></template>
          </F7ListItem>
          <F7ListItem :title="t('channel.installs7d')" :after="String(health.installs_7d)">
            <template #media
              ><F7Icon
                md="material:download_done"
                class="material-icons-outlined text-muted-foreground"
            /></template>
          </F7ListItem>
          <F7ListItem
            :title="t('channel.failures7d')"
            :after="String(health.failures_7d)"
            :class="{ 'text-destructive': health.failures_7d }"
          >
            <template #media
              ><F7Icon
                md="material:error_outline"
                class="material-icons-outlined text-muted-foreground"
            /></template>
          </F7ListItem>
        </F7List>
      </template>

      <template v-if="history.length">
        <F7BlockTitle>{{ t("channel.history") }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <ActivityListItem
            v-for="row in history"
            :key="row.id"
            :row="row"
            :app-name="release.app.name"
          />
        </F7List>
      </template>

      <F7BlockFooter v-if="!allowed">{{ t(`roles.purpose.${release.app.role}`) }}</F7BlockFooter>
    </template>

    <DeliverSheet
      :channel="delivering"
      :builds="release?.natives ?? []"
      @close="delivering = null"
      @pick="onPick"
    />
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import type { Channel, NativeBuild } from "@/domains/catalog/catalog.repository";
import ActivityListItem from "@/shared/components/app/ActivityListItem.vue";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import DeliverSheet from "@/shared/components/release/DeliverSheet.vue";
import { useAppStats } from "@/shared/composables/insights/useAppStats";
import { useAppRelease } from "@/shared/composables/release/useAppRelease";
import { useChannelActions } from "@/shared/composables/release/useChannelActions";
import { DEFAULT_WINDOW } from "@/shared/sync/insights";
import { formatPercent, formatRelative, versionLabel } from "@/shared/utils/format";
import ChannelHero from "../components/ChannelHero.vue";

/**
 * One channel: what it serves, how its fleet is taking it, and what happened to it. Delivery and
 * pausing sit in the bottom bar, offered only where the server would accept them.
 */
const props = defineProps<{ f7route: Router.Route; f7router: Router.Router }>();
useHiddenTabbar();
const { t, locale } = useI18n();

const channelId = String(props.f7route.params.channelId ?? "");
const { release, refresh } = useAppRelease();
const { stats, fetch } = useAppStats(ref(DEFAULT_WINDOW));

const view = computed(
  () => release.value?.channels.find((entry) => entry.channel.id === channelId) ?? null,
);
const app = computed(() => release.value?.app ?? null);
const actions = useChannelActions(app);
const delivering = ref<Channel | null>(null);

const allowed = computed(() => Boolean(view.value && actions.allowed(view.value.channel)));
const busy = computed(() => actions.busy.value === channelId);
const health = computed(
  () => stats.value?.channels.find((row) => row.channel_id === channelId) ?? null,
);
const history = computed(() =>
  (release.value?.activity ?? []).filter((row) => row.channel_name === view.value?.channel.name),
);

function onPick(build: NativeBuild, rollback: boolean): void {
  const channel = delivering.value;
  delivering.value = null;
  if (channel) void actions.deliver(channel, build, rollback);
}

async function refreshAll(): Promise<void> {
  await Promise.allSettled([refresh(), fetch(true)]);
}
</script>
