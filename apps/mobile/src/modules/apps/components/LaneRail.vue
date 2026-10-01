<template>
  <ol v-if="lanes.length" class="lane-rail" :aria-label="t('apps.lanes')">
    <li v-for="(lane, index) in lanes" :key="lane.channel.id" class="lane" :class="`lane-${lane.channel.environment ?? 'none'}`">
      <F7Icon v-if="index > 0" md="material:chevron_right" size="16" class="lane-arrow" aria-hidden="true" />
      <div class="lane-body">
        <span class="lane-name">
          <span class="lane-dot" aria-hidden="true" />
          {{ lane.channel.name }}
          <F7Icon v-if="lane.channel.paused" md="material:pause_circle" size="14" :aria-label="t('channel.paused')" />
        </span>
        <span class="lane-version cap-mono">{{ lane.build ? lane.build.version_name : "—" }}</span>
      </div>
    </li>
  </ol>
  <p v-else class="text-sm text-muted-foreground">{{ t("apps.noChannels") }}</p>
</template>

<script setup lang="ts">
import type { LaneSummary } from "../composables/useAppsOverview";

/** dev → staging → prod, each with the build it serves now: where a release stands, at a glance. */
defineProps<{ lanes: LaneSummary[] }>();
const { t } = useI18n();
</script>

<style scoped>
.lane-rail {
  display: flex;
  align-items: stretch;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
}

.lane {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.lane-arrow {
  color: var(--muted-foreground);
  flex: none;
}

.lane-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--lane-container, var(--muted));
  color: var(--lane-foreground, var(--muted-foreground));
}

.lane-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

.lane-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--lane-accent, var(--muted-foreground));
}

.lane-version {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lane-dev {
  --lane-container: var(--env-dev-container);
  --lane-foreground: var(--env-dev-foreground);
  --lane-accent: var(--env-dev);
}

.lane-staging {
  --lane-container: var(--env-staging-container);
  --lane-foreground: var(--env-staging-foreground);
  --lane-accent: var(--env-staging);
}

.lane-prod {
  --lane-container: var(--env-prod-container);
  --lane-foreground: var(--env-prod-foreground);
  --lane-accent: var(--env-prod);
}
</style>
