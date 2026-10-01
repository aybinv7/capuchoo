<template>
  <span class="live" :class="`live-${state}`" role="status" :aria-label="label">
    <LoadingIndicator v-if="syncing" :size="22" :label="label" />
    <span v-else class="live-dot" aria-hidden="true" />
  </span>
</template>

<script setup lang="ts">
import LoadingIndicator from "@/shared/components/progress/LoadingIndicator.vue";
import { liveState } from "@/shared/sync/live";
import { useSync } from "@/shared/sync/useSync";

/** Whether the screen is current: syncing, live on the event stream, retrying, or off. */
const { t } = useI18n();
const { syncing } = useSync();
const state = computed(() => liveState.value);
const label = computed(() => (syncing.value ? t("live.syncing") : t(`live.${state.value}`)));
</script>

<style scoped>
.live {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
}

.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--muted-foreground);
}

.live-live .live-dot {
  background: var(--env-prod);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--env-prod) 60%, transparent);
  animation: pulse 2.4s var(--ease-standard) infinite;
}

.live-retrying .live-dot,
.live-connecting .live-dot {
  background: var(--env-staging);
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--env-prod) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--env-prod) 0%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-live .live-dot {
    animation: none;
  }
}
</style>
