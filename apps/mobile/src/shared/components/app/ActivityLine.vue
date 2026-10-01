<template>
  <component :is="href ? 'a' : 'div'" :href="href" class="activity-line" :class="{ unread: !row.read_at }">
    <MaterialShape :shape="look.shape" class="grid size-10 shrink-0 place-items-center" :class="look.tone">
      <F7Icon :md="`material:${look.icon}`" size="20" />
    </MaterialShape>
    <div class="min-w-0 flex-1">
      <p class="text-sm leading-5" :class="row.read_at ? '' : 'font-semibold'">{{ title }}</p>
      <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>{{ formatRelative(row.created_at, locale) }}</span>
        <span v-if="row.detail && row.kind !== 'installed'" class="cap-mono">{{ t("activity.from", { version: row.detail }) }}</span>
      </p>
    </div>
    <span v-if="!row.read_at" class="unread-dot" :aria-label="t('activity.unread')" />
  </component>
</template>

<script setup lang="ts">
import type { Activity } from "@/domains/activity/activity.repository";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { activityTitle } from "@/shared/notify/notify";
import { formatRelative } from "@/shared/utils/format";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/** One thing that happened to an app, its kind told by shape and tone before it is read. */
const props = defineProps<{ row: Activity; appName: string; href?: string }>();
const { t, locale } = useI18n();

const LOOKS: Record<Activity["kind"], { shape: MaterialShapeName; icon: string; tone: string }> = {
  build: { shape: "cookie9", icon: "inventory_2", tone: "bg-secondary text-secondary-foreground" },
  delivered: { shape: "sunny", icon: "rocket_launch", tone: "bg-env-prod-container text-env-prod-foreground" },
  rolled_back: { shape: "pentagon", icon: "history", tone: "bg-env-staging-container text-env-staging-foreground" },
  paused: { shape: "pill", icon: "pause", tone: "bg-destructive-container text-destructive-container-foreground" },
  resumed: { shape: "pill", icon: "play_arrow", tone: "bg-env-prod-container text-env-prod-foreground" },
  installed: { shape: "flower", icon: "phone_android", tone: "bg-primary-container text-primary-container-foreground" },
  install_failed: { shape: "burst", icon: "error", tone: "bg-destructive-container text-destructive-container-foreground" },
};

const look = computed(() => LOOKS[props.row.kind] ?? LOOKS.build);
const title = computed(() => activityTitle(props.row, props.appName));
</script>

<style scoped>
.activity-line {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 4px;
  color: var(--foreground);
}

.unread-dot {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 999px;
  background: var(--primary);
}
</style>
