<template>
  <div class="success-card">
    <F7Gauge
      type="semicircle"
      :value="rate ?? 0"
      :size="220"
      :border-width="18"
      :border-color="colors.success"
      :border-bg-color="colors.track"
      :value-text="rate === null ? '—' : formatPercent(rate)"
      :value-text-color="colors.text"
      :value-font-size="40"
      :value-font-weight="700"
      :label-text="t('home.successLabel')"
      :label-text-color="colors.muted"
      :label-font-size="14"
      class="success-gauge"
    />
    <div class="grid w-full grid-cols-2 gap-2">
      <span class="outcome bg-env-prod-container text-env-prod-foreground">
        <F7Icon md="material:download_done" size="20" />
        <span class="cap-mono text-lg font-bold tabular-nums">{{ formatCount(installs) }}</span>
        <span class="text-xs">{{ t("home.installs") }}</span>
      </span>
      <span
        class="outcome"
        :class="
          failures
            ? 'bg-destructive-container text-destructive-container-foreground'
            : 'bg-muted text-muted-foreground'
        "
      >
        <F7Icon md="material:error_outline" size="20" />
        <span class="cap-mono text-lg font-bold tabular-nums">{{ formatCount(failures) }}</span>
        <span class="text-xs">{{ t("home.failures") }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCssColors } from "@/shared/composables/theme/useCssColors";
import { formatCount, formatPercent } from "@/shared/utils/format";

/** Install success as M3's semicircle gauge, with the two counts it is made of beneath it. */
defineProps<{ rate: number | null; installs: number; failures: number }>();
const { t } = useI18n();

const colors = useCssColors({
  success: "--env-prod",
  track: "--muted",
  text: "--foreground",
  muted: "--muted-foreground",
});
</script>

<style scoped>
.success-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 16px 16px;
  border-radius: var(--radius-xl-increased);
  background: var(--card);
}

.success-gauge {
  max-width: 100%;
}

.outcome {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
}

.outcome .text-xs {
  margin-inline-start: auto;
}
</style>
