<template>
  <F7List strong inset dividers media-list class="rounded-2xl!">
    <F7ListItem
      v-for="row in rows"
      :key="row.channel_id"
      :link="`/channels/${row.channel_id}/`"
      @click="tick"
    >
      <template #title>
        <span class="font-semibold">{{ row.name ?? row.channel_id.slice(0, 8) }}</span>
      </template>
      <template #after>
        <span class="text-xs tabular-nums">{{
          t("home.health.onCurrent", { on: row.on_current, total: row.devices })
        }}</span>
      </template>
      <template #subtitle>
        <F7Progressbar :progress="row.adoption * 100" class="health-bar my-2" />
      </template>
      <template #text>
        <span class="flex flex-wrap gap-x-3 tabular-nums">
          <span>{{ t("home.health.active", { count: row.active_24h }, row.active_24h) }}</span>
          <span>{{ t("home.health.installs", { count: row.installs_7d }, row.installs_7d) }}</span>
          <span :class="{ 'font-semibold text-destructive': row.failures_7d }">{{
            t("home.health.failures", { count: row.failures_7d }, row.failures_7d)
          }}</span>
        </span>
      </template>
    </F7ListItem>
  </F7List>
</template>

<script setup lang="ts">
import type { ChannelStats } from "@/shared/api/types";
import { tick } from "@/shared/utils/native/haptics";

/** How far each channel's fleet has moved to what it serves, busiest channel first. */
const props = defineProps<{ channels: readonly ChannelStats[] }>();
const { t } = useI18n();

const rows = computed(() =>
  [...props.channels]
    .sort((a, b) => b.devices - a.devices || (a.name ?? "").localeCompare(b.name ?? ""))
    .map((row) => ({ ...row, adoption: row.devices ? row.on_current / row.devices : 0 })),
);
</script>

<style scoped>
.health-bar {
  --f7-progressbar-height: 6px;
  --f7-progressbar-border-radius: 999px;
  --f7-progressbar-bg-color: var(--muted);
  --f7-progressbar-progress-color: var(--env-prod);
}
</style>
