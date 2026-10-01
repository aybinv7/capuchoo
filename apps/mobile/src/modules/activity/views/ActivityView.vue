<template>
  <F7Page class="cap-page" @page:afterin="onShown" @page:beforeout="onHidden">
    <F7Navbar large :title="t('activity.heading')" class="navbar-gradient">
      <F7NavRight>
        <F7Link v-if="unread" icon-only :aria-label="t('activity.readAll')" @click="readAll">
          <F7Icon md="material:done_all" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <div class="flex flex-col gap-4 px-4 pt-1">
      <Transition name="cap-fade">
        <section v-if="!notificationsOn" class="notify-banner">
          <MaterialShape shape="softBurst" class="grid size-11 shrink-0 place-items-center bg-tertiary text-tertiary-foreground">
            <F7Icon md="material:notifications_active" size="22" />
          </MaterialShape>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">{{ t("activity.notifyTitle") }}</p>
            <p class="text-xs opacity-80">{{ t("activity.notifyText") }}</p>
          </div>
          <F7Button tonal round small class="w-auto!" @click="enableNotifications">{{ t("activity.notifyAction") }}</F7Button>
        </section>
      </Transition>

      <EmptyState
        v-if="!loading && !days.length"
        icon="notifications_none"
        shape="flower"
        :title="t('activity.emptyTitle')"
        :text="t('activity.emptyText')"
      />

      <section v-for="day in days" :key="day.label" class="flex flex-col">
        <h2 class="day-title">{{ day.label }}</h2>
        <div class="rounded-[20px] bg-card px-3 shadow-card">
          <ActivityLine
            v-for="row in day.rows"
            :key="row.id"
            :row="row"
            :app-name="row.app_name"
            :href="`/apps/${row.app_id}/`"
          />
        </div>
      </section>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import ActivityLine from "@/shared/components/app/ActivityLine.vue";
import EmptyState from "@/shared/components/app/EmptyState.vue";
import MaterialShape from "@/shared/components/shape/MaterialShape.vue";
import { useActivityFeed } from "../composables/useActivityFeed";

const { t } = useI18n();
const { days, unread, loading, notificationsOn, checkNotifications, enableNotifications, readAll } = useActivityFeed();

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

<style scoped>
.day-title {
  margin: 0 0 8px;
  padding-inline: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.day-title::first-letter {
  text-transform: uppercase;
}

.notify-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-xl);
  background: var(--tertiary);
  color: var(--tertiary-foreground);
}
</style>
