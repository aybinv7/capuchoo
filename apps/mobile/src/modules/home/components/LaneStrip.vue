<template>
  <div class="lane-strip" role="list" :aria-label="t('home.lanes')">
    <a
      v-for="lane in lanes"
      :key="lane.channel.id"
      role="listitem"
      :href="`/channels/${lane.channel.id}/`"
      class="lane-card"
      :class="[`lane-${lane.channel.environment ?? 'none'}`, { paused: lane.channel.paused }]"
      @click="tick"
    >
      <span class="flex items-center justify-between gap-2">
        <span class="text-xs font-semibold tracking-wide uppercase">{{ lane.channel.name }}</span>
        <F7Icon v-if="lane.channel.paused" md="material:pause_circle" size="18" />
      </span>
      <span class="cap-mono text-lg leading-6 font-bold tracking-tight break-all">{{
        lane.build?.version_name ?? "—"
      }}</span>
      <span class="cap-mono text-xs opacity-80">{{
        lane.build ? `#${lane.build.version_code}` : t("home.noBuild")
      }}</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import type { LaneSummary } from "@/shared/release/lanes";
import { tick } from "@/shared/utils/native/haptics";

/**
 * Where each release stands, in promotion order: one tonal card per channel, coloured by its
 * environment, the version it serves as the headline. The release dashboard's first question.
 */
defineProps<{ lanes: LaneSummary[] }>();
const { t } = useI18n();
</script>

<style scoped>
.lane-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(148px, 1fr);
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 16px;
  padding-inline: 16px;
  scrollbar-width: none;
}

.lane-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  border-radius: var(--radius-xl);
  scroll-snap-align: start;
  background: var(--lane-bg, var(--muted));
  color: var(--lane-fg, var(--foreground));
  transition: scale 150ms ease;
}

.lane-card:active {
  scale: 0.97;
}

.lane-dev {
  --lane-bg: var(--env-dev-container);
  --lane-fg: var(--env-dev-foreground);
}

.lane-staging {
  --lane-bg: var(--env-staging-container);
  --lane-fg: var(--env-staging-foreground);
}

.lane-prod {
  --lane-bg: var(--env-prod-container);
  --lane-fg: var(--env-prod-foreground);
}

.lane-card.paused {
  --lane-bg: var(--destructive-container);
  --lane-fg: var(--destructive-container-foreground);
}
</style>
