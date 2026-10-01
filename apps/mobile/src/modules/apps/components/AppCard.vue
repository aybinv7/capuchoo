<template>
  <a :href="`/apps/${summary.app.id}/`" class="app-card" :style="{ '--stagger': `${index * 28}ms` }" @click="tick">
    <div class="flex items-center gap-3">
      <AppIcon :name="summary.app.name" :bundle-id="summary.app.bundle_id" :icon-url="summary.app.icon_url" :size="52" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-lg leading-6 font-semibold">{{ summary.app.name }}</p>
        <p class="cap-mono truncate text-xs text-muted-foreground">{{ summary.app.bundle_id }}</p>
      </div>
      <span class="rounded-sm bg-secondary px-2 py-1 text-[11px] font-semibold tracking-wide text-secondary-foreground uppercase">
        {{ t(`roles.name.${summary.app.role}`) }}
      </span>
    </div>

    <LaneRail :lanes="summary.lanes" />

    <div class="flex items-center justify-between gap-2">
      <PhoneBadge :status="summary.phone" />
      <span v-if="summary.clientCount" class="text-xs text-muted-foreground">
        {{ t("apps.clients", { count: summary.clientCount }, summary.clientCount) }}
      </span>
    </div>
  </a>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import { tick } from "@/shared/utils/native/haptics";
import type { AppSummary } from "../composables/useAppsOverview";
import LaneRail from "./LaneRail.vue";
import PhoneBadge from "./PhoneBadge.vue";

defineProps<{ summary: AppSummary; index: number }>();
const { t } = useI18n();
</script>

<style scoped>
/*
 * A card per app: a near-solid surface one step above the page, its rows spaced by gap, landing
 * with a short stagger. Pressing settles it a little - the M3 Expressive press, transform only.
 */
.app-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius-xl);
  background: var(--card);
  color: var(--card-foreground);
  box-shadow: var(--elevation-card);
  transition: transform var(--duration-short) var(--ease-spring-fast);
  animation: card-in var(--duration-long) var(--ease-emphasized-decelerate) both;
  animation-delay: var(--stagger);
}

.app-card:active {
  transform: scale(0.98);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
</style>
