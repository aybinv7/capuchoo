<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar :title="detail?.app.name ?? ''" back-link class="navbar-gradient" :sliding="true" />

    <template #fixed>
      <PullToRefresh :tables="[]" :action="refresh" />
    </template>

    <div v-if="!detail" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <template v-else>
      <div class="flex flex-col gap-5 px-4 pt-2">
        <header class="flex items-center gap-4">
          <AppIcon
            :name="detail.app.name"
            :bundle-id="detail.app.bundle_id"
            :icon-url="detail.app.icon_url"
            :size="64"
          />
          <div class="min-w-0 flex-1">
            <h1 class="m-0 truncate text-[26px] leading-8 font-bold tracking-tight">
              {{ detail.app.name }}
            </h1>
            <p class="cap-mono m-0 truncate text-xs text-muted-foreground">
              {{ detail.app.bundle_id }}
            </p>
          </div>
          <F7Badge class="shrink-0 bg-secondary! text-secondary-foreground!">{{
            t(`roles.name.${detail.app.role}`)
          }}</F7Badge>
        </header>

        <PhoneCard
          :status="detail.phone"
          :can-install="canInstall"
          :job="phoneJob"
          @install="installTarget"
          @cancel="detail.phone.target && cancel(detail.phone.target.id)"
          @open="openOnPhone"
        />
      </div>

      <F7BlockTitle>{{ t("app.channels") }}</F7BlockTitle>
      <F7List v-if="detail.channels.length" strong inset dividers media-list class="rounded-2xl!">
        <ChannelListItem
          v-for="view in detail.channels"
          :key="view.channel.id"
          :view="view"
          :actionable="actions.allowed(view.channel) && actions.busy.value !== view.channel.id"
          @open="openChannel(view.channel)"
        />
      </F7List>
      <F7BlockFooter>
        {{ detail.channels.length ? t(`roles.purpose.${detail.app.role}`) : t("apps.noChannels") }}
      </F7BlockFooter>

      <F7BlockTitle>
        {{ t("app.builds") }}
        <span class="ms-1 font-normal">· {{ detail.natives.length }}</span>
      </F7BlockTitle>
      <F7List v-if="detail.natives.length" strong inset dividers media-list class="rounded-2xl!">
        <BuildListItem
          v-for="build in visibleBuilds"
          :key="build.id"
          :build="build"
          :href="`/apps/${appId}/builds/${build.id}/`"
          :installed="installedCodes.has(build.version_code)"
        />
        <F7ListButton v-if="detail.natives.length > PAGE && !showAll" @click="showAll = true">
          {{ t("app.showAll", { count: detail.natives.length }) }}
        </F7ListButton>
      </F7List>
      <F7BlockFooter v-else>{{ t("app.noBuilds") }}</F7BlockFooter>

      <template v-if="detail.activity.length">
        <F7BlockTitle>{{ t("app.recent") }}</F7BlockTitle>
        <F7List strong inset dividers media-list class="rounded-2xl!">
          <ActivityListItem
            v-for="row in detail.activity"
            :key="row.id"
            :row="row"
            :app-name="detail.app.name"
          />
        </F7List>
      </template>
    </template>

    <DeliverSheet
      :channel="delivering"
      :builds="detail?.natives ?? []"
      @close="delivering = null"
      @pick="onPick"
    />
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import type { Channel, NativeBuild } from "@/domains/catalog/catalog.repository";
import { can } from "@/shared/access/capabilities";
import ActivityListItem from "@/shared/components/app/ActivityListItem.vue";
import AppIcon from "@/shared/components/app/AppIcon.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import { CapuchooDevice, hasDevice } from "@/shared/native/device";
import BuildListItem from "../components/BuildListItem.vue";
import ChannelListItem from "../components/ChannelListItem.vue";
import DeliverSheet from "../components/DeliverSheet.vue";
import PhoneCard from "../components/PhoneCard.vue";
import { useAppDetail } from "../composables/useAppDetail";
import { useChannelActions } from "../composables/useChannelActions";
import { useInstaller } from "../composables/useInstaller";

const PAGE = 12;

const props = defineProps<{ f7route: Router.Route; f7router: Router.Router }>();
useHiddenTabbar();
const { t } = useI18n();

const appId = String(props.f7route.params.appId ?? "");
const { detail, refresh } = useAppDetail(appId);
const app = computed(() => detail.value?.app);
const actions = useChannelActions(app);
const { install, cancel, jobFor } = useInstaller();

const showAll = ref(false);
const delivering = ref<Channel | null>(null);

const canInstall = computed(() =>
  Boolean(detail.value && can.install(detail.value.app) && hasDevice()),
);
const visibleBuilds = computed(
  () => (showAll.value ? detail.value?.natives : detail.value?.natives.slice(0, PAGE)) ?? [],
);
const installedCodes = computed(
  () =>
    new Set(
      (detail.value?.installed ?? []).filter((row) => row.installed).map((row) => row.version_code),
    ),
);
const phoneJob = computed(() =>
  detail.value?.phone.target ? jobFor(detail.value.phone.target.id) : undefined,
);

function installTarget(): void {
  const data = detail.value;
  const target = data?.natives.find((build) => build.id === data.phone.target?.id);
  if (data && target)
    void install({
      app: data.app,
      build: target,
      identifiers: data.identifiers,
      installed: data.installed,
    });
}

async function openOnPhone(): Promise<void> {
  const bundleId = detail.value?.phone.bundleId;
  if (bundleId && hasDevice()) await CapuchooDevice.open({ packageName: bundleId });
}

/** A channel's actions as an M3 bottom action sheet: the channel named, then what can be done to it. */
function openChannel(channel: Channel): void {
  const sheet = f7.actions.create({
    buttons: [
      [
        { text: channel.name, label: true },
        { text: t("channel.deliverAction"), onClick: () => (delivering.value = channel) },
        {
          text: channel.paused ? t("channel.resume") : t("channel.pause"),
          color: channel.paused ? undefined : "red",
          onClick: () => void actions.togglePause(channel),
        },
      ],
      [{ text: t("common.cancel") }],
    ],
    on: { closed: () => sheet.destroy() },
  });
  sheet.open();
}

function onPick(build: NativeBuild, rollback: boolean): void {
  const channel = delivering.value;
  delivering.value = null;
  if (channel) void actions.deliver(channel, build, rollback);
}
</script>
