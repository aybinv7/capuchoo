<template>
  <F7Link
    class="app-switch"
    :aria-label="t('topbar.switchApp', { app: app?.name ?? '' })"
    @click="open"
  >
    <AppIcon
      v-if="app"
      :name="app.name"
      :bundle-id="app.bundle_id"
      :icon-url="app.icon_url"
      :size="32"
    />
    <F7Icon md="material:unfold_more" size="20" class="text-muted-foreground" />
  </F7Link>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import { useAppSwitcher } from "@/shared/composables/apps/useAppSwitcher";
import { useCurrentApp } from "@/shared/composables/apps/useCurrentApp";

/** The app on screen as its icon, top-start on every tab: the way into another one. */
const { t } = useI18n();
const { app } = useCurrentApp();
const { open } = useAppSwitcher();
</script>

<style scoped>
.app-switch {
  gap: 2px;
  padding-inline: 8px 4px !important;
  border-radius: 999px;
}
</style>
