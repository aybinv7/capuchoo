<template>
  <F7Page class="cap-page" @page:afterin="onShown" @page:beforeout="onHidden">
    <F7Navbar large :title="t('activity.heading')" class="navbar-gradient">
      <F7NavRight>
        <F7Link v-if="unread" icon-only :aria-label="t('activity.readAll')" @click="readAll">
          <F7Icon md="material:done_all" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <template #fixed>
      <PullToRefresh :tables="['activity', 'app']" :action="refresh" />
    </template>

    <F7List v-if="!notificationsOn" strong inset media-list class="rounded-2xl!">
      <F7ListItem :title="t('activity.notifyTitle')" :text="t('activity.notifyText')">
        <template #media>
          <MaterialShape
            shape="softBurst"
            class="grid size-10 place-items-center bg-tertiary text-tertiary-foreground"
          >
            <F7Icon md="material:notifications_active" size="20" />
          </MaterialShape>
        </template>
        <template #after>
          <F7Button tonal round small class="w-auto!" @click="enableNotifications">{{
            t("activity.notifyAction")
          }}</F7Button>
        </template>
      </F7ListItem>
    </F7List>

    <template v-for="day in days" :key="day.label">
      <F7BlockTitle class="capitalize">{{ day.label }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <ActivityListItem
          v-for="row in day.rows"
          :key="row.id"
          :row="row"
          :app-name="row.app_name"
          show-app
          :href="`/apps/${row.app_id}/`"
        />
      </F7List>
    </template>

    <EmptyState
      v-if="!loading && !days.length"
      icon="notifications_none"
      shape="flower"
      :title="t('activity.emptyTitle')"
      :text="t('activity.emptyText')"
    />
  </F7Page>
</template>

<script setup lang="ts">
import ActivityListItem from "@/shared/components/app/ActivityListItem.vue";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import PullToRefresh from "@/shared/components/refresh/PullToRefresh.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { useSync } from "@/shared/sync/useSync";
import { useActivityFeed } from "../composables/useActivityFeed";

const { t } = useI18n();
const { days, unread, loading, notificationsOn, checkNotifications, enableNotifications, readAll } =
  useActivityFeed();
const { refresh } = useSync();

/** Read means seen: rows are marked read after the tab has been on screen for a moment, not on arrival. */
const SEEN_AFTER_MS = 1800;
let seen: ReturnType<typeof setTimeout> | undefined;

function onShown(): void {
  void checkNotifications();
  clearTimeout(seen);
  seen = setTimeout(() => void readAll(), SEEN_AFTER_MS);
}

function onHidden(): void {
  clearTimeout(seen);
}

onBeforeUnmount(onHidden);
</script>
