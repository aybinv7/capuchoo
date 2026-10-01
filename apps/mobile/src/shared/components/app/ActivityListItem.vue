<template>
  <F7ListItem
    :link="href ?? false"
    :class="{ 'activity-unread': !row.read_at }"
    @click="href && tick()"
  >
    <template #media>
      <MaterialShape :shape="look.shape" class="grid size-10 place-items-center" :class="look.tone">
        <F7Icon :md="`material:${look.icon}`" size="20" />
      </MaterialShape>
    </template>
    <template #title>
      <span class="activity-title">{{ title }}</span>
    </template>
    <template #after>
      <span class="flex items-center gap-1.5 text-xs tabular-nums">
        {{ formatRelative(row.created_at, locale) }}
        <span
          v-if="!row.read_at"
          class="size-2 rounded-full bg-primary"
          :aria-label="t('activity.unread')"
        />
      </span>
    </template>
    <template v-if="caption" #text>
      <span class="cap-mono">{{ caption }}</span>
    </template>
  </F7ListItem>
</template>

<script setup lang="ts">
import type { Activity } from "@/domains/activity/activity.repository";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { activityTitle } from "@/shared/notify/notify";
import { formatRelative } from "@/shared/utils/format";
import { tick } from "@/shared/utils/native/haptics";
import type { MaterialShapeName } from "@/shared/utils/shapes/materialShapes";

/**
 * One thing that happened to an app, as a row of a media list: its kind told by shape and tone
 * before it is read, the app named on the feed and left out on the app's own screen.
 */
const props = defineProps<{ row: Activity; appName: string; href?: string; showApp?: boolean }>();
const { t, locale } = useI18n();

const LOOKS: Record<Activity["kind"], { shape: MaterialShapeName; icon: string; tone: string }> = {
  build: { shape: "cookie9", icon: "inventory_2", tone: "bg-secondary text-secondary-foreground" },
  delivered: {
    shape: "sunny",
    icon: "rocket_launch",
    tone: "bg-env-prod-container text-env-prod-foreground",
  },
  rolled_back: {
    shape: "pentagon",
    icon: "history",
    tone: "bg-env-staging-container text-env-staging-foreground",
  },
  paused: {
    shape: "pill",
    icon: "pause",
    tone: "bg-destructive-container text-destructive-container-foreground",
  },
  resumed: {
    shape: "pill",
    icon: "play_arrow",
    tone: "bg-env-prod-container text-env-prod-foreground",
  },
  installed: {
    shape: "flower",
    icon: "phone_android",
    tone: "bg-primary-container text-primary-container-foreground",
  },
  install_failed: {
    shape: "burst",
    icon: "error",
    tone: "bg-destructive-container text-destructive-container-foreground",
  },
};

const look = computed(() => LOOKS[props.row.kind] ?? LOOKS.build);
const title = computed(() => activityTitle(props.row, props.appName));

const caption = computed(() => {
  const parts: string[] = [];
  if (props.showApp && props.row.kind !== "build") parts.push(props.appName);
  if (props.row.detail && props.row.kind !== "installed")
    parts.push(t("activity.from", { version: props.row.detail }));
  return parts.join(" · ");
});
</script>

<style scoped>
.activity-title {
  white-space: normal;
  font-size: 15px;
  line-height: 20px;
}

.activity-unread .activity-title {
  font-weight: 600;
}
</style>
