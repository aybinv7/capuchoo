<template>
  <F7Link
    icon-only
    href="/activity/"
    :aria-label="badge ? t('topbar.notificationsUnread', { count }) : t('topbar.notifications')"
  >
    <span class="relative">
      <F7Icon
        md="material:notifications"
        :class="badge ? '' : 'material-icons-outlined'"
        size="24"
      />
      <span v-if="badge" class="top-badge" aria-hidden="true">{{ badge }}</span>
    </span>
  </F7Link>
  <F7Link icon-only href="/profile/" class="avatar-link" :aria-label="t('topbar.account')">
    <AppIcon
      :name="account?.full_name || account?.email || '?'"
      :bundle-id="account?.email ?? 'account'"
      shape="circle"
      :size="38"
    />
  </F7Link>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import { useUnreadCount } from "@/shared/composables/activity/useUnreadCount";
import { useCurrentApp } from "@/shared/composables/apps/useCurrentApp";

/** Top-end on every tab: what happened, then who is signed in - the two that are not places. */
const { t } = useI18n();
const { count, badge } = useUnreadCount();
const { account } = useCurrentApp();
</script>

<style scoped>
/* The avatar is the bar's one picture, as big as the app switcher's icon, not an icon's 24dp. */
.avatar-link {
  width: auto !important;
  min-width: 48px;
  padding-inline: 4px 8px !important;
}

/* M3's large badge: 16dp, error-coloured, on the icon's top-end corner. */
.top-badge {
  position: absolute;
  top: -4px;
  inset-inline-start: 14px;
  min-width: 16px;
  height: 16px;
  padding-inline: 4px;
  border-radius: 999px;
  background: var(--destructive);
  color: var(--destructive-foreground);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
