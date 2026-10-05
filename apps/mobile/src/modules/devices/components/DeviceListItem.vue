<template>
  <F7ListItem :link="`/devices/${device.id}/`" @click="tick">
    <template #media>
      <span class="relative">
        <span class="grid size-10 place-items-center rounded-xl" :class="tone">
          <F7Icon
            :md="device.is_emulator ? 'material:devices_other' : 'material:smartphone'"
            size="20"
          />
        </span>
        <span v-if="active" class="live-dot" :aria-label="t('devices.activeNow')" />
      </span>
    </template>
    <template #title>
      <span class="font-semibold">{{ title }}</span>
    </template>
    <template #after>
      <span class="text-xs tabular-nums">{{ formatRelative(device.last_seen_at, locale) }}</span>
    </template>
    <template #subtitle>
      <span class="flex flex-wrap items-center gap-x-2">
        <span class="cap-mono font-semibold">{{
          versionLabel(device.version_name, device.version_code)
        }}</span>
        <span v-if="device.channel_name" class="text-muted-foreground"
          >· {{ device.channel_name }}</span
        >
      </span>
    </template>
    <template #text>
      <span class="truncate">{{ hardware }}</span>
      <span v-if="device.assigned_channel_id" class="ms-2 font-semibold text-primary">{{
        t("devices.overridden")
      }}</span>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import type { Device } from "@/domains/insights/insights.repository";
import { formatRelative, versionLabel } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";
import { deviceTitle, isActive } from "../lib/deviceLabel";

/** A phone running the app: what it runs, where from, and when it last asked for an update. */
const props = defineProps<{ device: Device }>();
const { t, locale } = useI18n();

const title = computed(() => deviceTitle(props.device));
const active = computed(() => isActive(props.device));
const tone = computed(() =>
  props.device.is_emulator
    ? "bg-muted text-muted-foreground"
    : "bg-secondary text-secondary-foreground",
);
const hardware = computed(() =>
  [
    props.device.manufacturer,
    props.device.version_os
      ? `${props.device.platform} ${props.device.version_os}`
      : props.device.platform,
  ]
    .filter(Boolean)
    .join(" · "),
);
</script>

<style scoped>
.live-dot {
  position: absolute;
  inset-inline-end: -2px;
  bottom: -2px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--env-prod);
  box-shadow: 0 0 0 2px var(--card);
}
</style>
