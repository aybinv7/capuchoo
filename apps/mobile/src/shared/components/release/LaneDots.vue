<template>
  <span v-if="lanes.length" class="lane-dots" :aria-label="t('apps.lanes')">
    <span
      v-for="lane in lanes"
      :key="lane.channel.id"
      class="lane"
      :class="{ paused: lane.channel.paused }"
    >
      <span class="dot" :class="`dot-${lane.channel.environment ?? 'none'}`" aria-hidden="true" />
      <span>{{ lane.channel.name }}</span>
      <span class="cap-mono lane-version">{{ lane.build?.version_name ?? "—" }}</span>
      <F7Icon
        v-if="lane.channel.paused"
        md="material:pause_circle"
        size="14"
        :aria-label="t('channel.paused')"
      />
    </span>
  </span>
  <span v-else>{{ t("apps.noChannels") }}</span>
</template>

<script setup lang="ts">
import type { LaneSummary } from "@/shared/release/lanes";

/** Each release channel and the build it serves, on one line: where a release stands. */
defineProps<{ lanes: LaneSummary[] }>();
const { t } = useI18n();
</script>

<style scoped>
.lane-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
}

.lane {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.lane.paused {
  color: var(--destructive);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--muted-foreground);
}

.dot-dev {
  background: var(--env-dev);
}

.dot-staging {
  background: var(--env-staging);
}

.dot-prod {
  background: var(--env-prod);
}

.lane-version {
  color: var(--foreground);
  font-weight: 600;
}
</style>
