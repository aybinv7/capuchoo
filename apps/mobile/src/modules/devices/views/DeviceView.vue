<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar :title="device ? title : ''" back-link class="navbar-gradient" :sliding="true" />

    <F7Toolbar v-if="device && (assignable || canRemove)" bottom>
      <div class="flex w-full gap-2 px-3">
        <F7Button
          v-if="assignable"
          fill
          round
          large
          class="flex-1 font-semibold!"
          :class="{ disabled: busy }"
          @click="openAssign"
        >
          <F7Icon md="material:alt_route" size="20" class="me-2" />
          {{ t("device.assign") }}
        </F7Button>
        <F7Button
          v-if="canRemove"
          tonal
          round
          large
          class="device-remove flex-1 font-semibold!"
          :class="{ disabled: busy }"
          @click="onRemove"
        >
          <F7Icon md="material:delete_outline" size="20" class="me-2" />
          {{ t("device.remove") }}
        </F7Button>
      </div>
    </F7Toolbar>

    <EmptyState
      v-if="!device"
      icon="devices_other"
      :title="t('device.goneTitle')"
      :text="t('device.goneText')"
    />

    <template v-else>
      <header class="flex flex-col items-center gap-2 px-6 pt-2 pb-4 text-center">
        <MaterialShape
          :shape="device.is_emulator ? 'pentagon' : 'cookie9'"
          class="hero-shape grid size-24 place-items-center"
          :class="
            active
              ? 'bg-env-prod-container text-env-prod-foreground'
              : 'bg-secondary text-secondary-foreground'
          "
        >
          <F7Icon
            :md="device.is_emulator ? 'material:devices_other' : 'material:smartphone'"
            size="44"
          />
        </MaterialShape>
        <h1 class="m-0 text-[26px] leading-8 font-bold tracking-tight">{{ title }}</h1>
        <p class="m-0 text-sm text-muted-foreground">
          {{
            active
              ? t("device.seenActive", { when: formatRelative(device.last_seen_at, locale) })
              : t("device.seen", { when: formatRelative(device.last_seen_at, locale) })
          }}
        </p>
      </header>

      <F7BlockTitle>{{ t("device.release") }}</F7BlockTitle>
      <F7List strong inset dividers class="rounded-2xl!">
        <F7ListItem
          v-for="row in releaseFacts"
          :key="row.label"
          :title="row.label"
          :after="row.value"
        >
          <template #media
            ><F7Icon
              :md="`material:${row.icon}`"
              class="material-icons-outlined text-muted-foreground"
          /></template>
        </F7ListItem>
      </F7List>

      <F7BlockTitle>{{ t("device.hardware") }}</F7BlockTitle>
      <F7List strong inset dividers class="rounded-2xl!">
        <F7ListItem
          v-for="row in hardwareFacts"
          :key="row.label"
          :title="row.label"
          :after="row.value"
        >
          <template #media
            ><F7Icon
              :md="`material:${row.icon}`"
              class="material-icons-outlined text-muted-foreground"
          /></template>
        </F7ListItem>
      </F7List>

      <F7BlockTitle>{{ t("device.identity") }}</F7BlockTitle>
      <F7Block strong inset class="rounded-2xl!">
        <p class="m-0 text-xs text-muted-foreground">{{ t("device.deviceId") }}</p>
        <p class="cap-mono cap-selectable m-0 text-sm break-all">{{ device.device_id }}</p>
        <template v-if="device.plugin_version">
          <p class="mt-3 mb-0 text-xs text-muted-foreground">{{ t("device.plugin") }}</p>
          <p class="cap-mono cap-selectable m-0 text-sm break-all">{{ device.plugin_version }}</p>
        </template>
        <template v-if="device.custom_id">
          <p class="mt-3 mb-0 text-xs text-muted-foreground">{{ t("device.customId") }}</p>
          <p class="cap-mono cap-selectable m-0 text-sm break-all">{{ device.custom_id }}</p>
        </template>
      </F7Block>
    </template>
    <ChannelPickerSheet
      :opened="picking"
      :device-name="title"
      :channels="assignViews"
      :override-id="device?.assigned_channel_id ?? null"
      :served-id="device?.channel_id ?? null"
      :can-clear="Boolean(device?.assigned_channel_id) && canAssign(null)"
      @close="picking = false"
      @pick="onPick"
    />
  </F7Page>
</template>

<script setup lang="ts">
import type { Router } from "framework7/types";
import type { Channel } from "@/domains/catalog/catalog.repository";
import { getDevice } from "@/domains/insights/insights.repository";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { useAppRelease } from "@/shared/composables/release/useAppRelease";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { formatRelative, versionLabel } from "@/shared/utils/format";
import ChannelPickerSheet from "../components/ChannelPickerSheet.vue";
import { useDeviceActions } from "../composables/useDeviceActions";
import { deviceTitle, isActive } from "../lib/deviceLabel";

/**
 * One device as the server last heard from it: the release it runs and where from, the hardware,
 * and its ids. Overriding its channel and forgetting it sit in the bottom bar, by role.
 */
const props = defineProps<{ f7route: Router.Route; f7router: Router.Router }>();
useHiddenTabbar();
const { t, locale } = useI18n();

const deviceId = String(props.f7route.params.deviceId ?? "");
const query = useReactiveQuery(() => getDevice(getDatabase().db, deviceId), {
  tables: ["device"],
  queryKey: ["device", deviceId],
});
const device = computed(() => query.data.value ?? null);
const { release } = useAppRelease();
const app = computed(() => release.value?.app ?? null);
const { busy, canAssign, canRemove, assign, remove } = useDeviceActions(app);

const title = computed(() => (device.value ? deviceTitle(device.value) : ""));
const active = computed(() => (device.value ? isActive(device.value) : false));
const channels = computed(() => (release.value?.channels ?? []).map((view) => view.channel));
const picking = ref(false);
const assignViews = computed(() =>
  (release.value?.channels ?? []).filter((view) => canAssign(view.channel)),
);
const assignable = computed(() => assignViews.value.length > 0);

const channelName = (id: string | null) =>
  id ? (channels.value.find((channel) => channel.id === id)?.name ?? "—") : "—";

const releaseFacts = computed(() => {
  const row = device.value;
  if (!row) return [];
  return [
    {
      icon: "android",
      label: t("device.version"),
      value: versionLabel(row.version_name, row.version_code),
    },
    { icon: "layers", label: t("device.servedBy"), value: row.channel_name ?? "—" },
    {
      icon: "alt_route",
      label: t("device.override"),
      value: row.assigned_channel_id ? channelName(row.assigned_channel_id) : t("device.none"),
    },
    {
      icon: "verified",
      label: t("device.build"),
      value:
        row.is_prod === null ? "—" : row.is_prod ? t("device.buildProd") : t("device.buildDebug"),
    },
  ];
});

const hardwareFacts = computed(() => {
  const row = device.value;
  if (!row) return [];
  return [
    {
      icon: "smartphone",
      label: t("device.model"),
      value: [row.manufacturer, row.model].filter(Boolean).join(" ") || "—",
    },
    {
      icon: "settings",
      label: t("device.os"),
      value: row.version_os ? `${row.platform} ${row.version_os}` : row.platform,
    },
    {
      icon: "devices_other",
      label: t("device.emulator"),
      value: row.is_emulator === null ? "—" : row.is_emulator ? t("common.yes") : t("common.no"),
    },
    {
      icon: "history",
      label: t("device.firstSeen"),
      value: formatRelative(row.created_at, locale.value),
    },
  ];
});

function openAssign(): void {
  if (device.value) picking.value = true;
}

function onPick(channel: Channel | null): void {
  picking.value = false;
  const row = device.value;
  if (row) void assign(row, channel);
}

async function onRemove(): Promise<void> {
  const row = device.value;
  if (row && (await remove(row, title.value))) props.f7router.back();
}
</script>

<style scoped>
.hero-shape {
  animation: hero-in 640ms var(--ease-spring-fast) both;
}

.device-remove {
  --f7-button-text-color: var(--destructive);
}

@keyframes hero-in {
  from {
    transform: scale(0.3) rotate(-90deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-shape {
    animation: none;
  }
}
</style>
