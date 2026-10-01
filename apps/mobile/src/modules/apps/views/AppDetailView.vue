<template>
  <F7Page class="cap-page" ptr @ptr:refresh="onRefresh">
    <F7Navbar :title="detail?.app.name ?? ''" back-link class="navbar-gradient" :sliding="true" />

    <div v-if="!detail" class="grid place-items-center py-24">
      <LoadingIndicator contained :size="56" :label="t('live.syncing')" />
    </div>

    <div v-else class="flex flex-col gap-6 px-4 pt-2">
      <header class="flex items-center gap-4">
        <AppIcon :name="detail.app.name" :bundle-id="detail.app.bundle_id" :icon-url="detail.app.icon_url" :size="72" />
        <div class="min-w-0">
          <h1 class="truncate text-[28px] leading-9 font-bold tracking-tight">{{ detail.app.name }}</h1>
          <p class="cap-mono truncate text-xs text-muted-foreground">{{ detail.app.bundle_id }}</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ t(`roles.purpose.${detail.app.role}`) }}</p>
        </div>
      </header>

      <PhoneCard
        :status="detail.phone"
        :can-install="canInstall"
        :job="phoneJob"
        @install="installTarget"
        @cancel="detail.phone.target && cancel(detail.phone.target.id)"
        @open="openOnPhone"
      />

      <section class="flex flex-col gap-3">
        <h2 class="section-title">{{ t("app.channels") }}</h2>
        <ChannelCard
          v-for="view in detail.channels"
          :key="view.channel.id"
          :view="view"
          :can-deliver="actions.allowed(view.channel)"
          :busy="actions.busy.value === view.channel.id"
          @deliver="delivering = view.channel"
          @toggle-pause="actions.togglePause(view.channel)"
        />
        <p v-if="!detail.channels.length" class="text-sm text-muted-foreground">{{ t("apps.noChannels") }}</p>
      </section>

      <section class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between">
          <h2 class="section-title">{{ t("app.builds") }}</h2>
          <span class="text-xs text-muted-foreground">{{ t("app.buildCount", { count: detail.natives.length }, detail.natives.length) }}</span>
        </div>
        <div class="overflow-hidden rounded-[20px] bg-card shadow-card">
          <BuildItem
            v-for="build in visibleBuilds"
            :key="build.id"
            :build="build"
            :href="`/apps/${appId}/builds/${build.id}/`"
            :installed="installedCodes.has(build.version_code)"
          />
          <p v-if="!detail.natives.length" class="px-4 py-6 text-sm text-muted-foreground">{{ t("app.noBuilds") }}</p>
        </div>
        <F7Button v-if="detail.natives.length > PAGE && !showAll" tonal round class="self-center w-auto! px-6!" @click="showAll = true">
          {{ t("app.showAll", { count: detail.natives.length }) }}
        </F7Button>
      </section>

      <section v-if="detail.activity.length" class="flex flex-col gap-3">
        <h2 class="section-title">{{ t("app.recent") }}</h2>
        <ActivityLine v-for="row in detail.activity" :key="row.id" :row="row" :app-name="detail.app.name" />
      </section>
    </div>

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
import ActivityLine from "@/shared/components/app/ActivityLine.vue";
import AppIcon from "@/shared/components/app/AppIcon.vue";
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import { CapuchooDevice, hasDevice } from "@/shared/native/device";
import BuildItem from "../components/BuildItem.vue";
import ChannelCard from "../components/ChannelCard.vue";
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

const canInstall = computed(() => Boolean(detail.value && can.install(detail.value.app) && hasDevice()));
const visibleBuilds = computed(() => (showAll.value ? detail.value?.natives : detail.value?.natives.slice(0, PAGE)) ?? []);
const installedCodes = computed(
  () => new Set((detail.value?.installed ?? []).filter((row) => row.installed).map((row) => row.version_code)),
);
const phoneJob = computed(() => (detail.value?.phone.target ? jobFor(detail.value.phone.target.id) : undefined));

function installTarget(): void {
  const data = detail.value;
  const target = data?.natives.find((build) => build.id === data.phone.target?.id);
  if (data && target) void install({ app: data.app, build: target, identifiers: data.identifiers, installed: data.installed });
}

async function openOnPhone(): Promise<void> {
  const bundleId = detail.value?.phone.bundleId;
  if (bundleId && hasDevice()) await CapuchooDevice.open({ packageName: bundleId });
}

function onPick(build: NativeBuild, rollback: boolean): void {
  const channel = delivering.value;
  delivering.value = null;
  if (channel) void actions.deliver(channel, build, rollback);
}

function onRefresh(done: () => void): void {
  refresh().finally(done);
}
</script>

<style scoped>
.section-title {
  margin: 0;
  padding-inline: 4px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--muted-foreground);
}
</style>
