<template>
  <F7Sheet
    class="app-switcher"
    :opened="opened"
    swipe-to-close
    backdrop
    close-by-backdrop-click
    @sheet:closed="close"
  >
    <div class="swipe-handler" />
    <F7PageContent class="app-switcher-content">
      <F7BlockTitle medium class="mt-1!">{{ t("switcher.title") }}</F7BlockTitle>
      <F7List strong inset dividers media-list class="rounded-2xl!">
        <AppPickerItem
          v-for="choice in choices"
          :key="choice.app.id"
          :choice="choice"
          :current="choice.app.id === currentAppId"
          @select="choose(choice.app.id)"
        />
      </F7List>
    </F7PageContent>
  </F7Sheet>
</template>

<script setup lang="ts">
import AppPickerItem from "@/shared/components/app/AppPickerItem.vue";
import { useAppSwitcher } from "@/shared/composables/apps/useAppSwitcher";
import { useAppList } from "@/shared/composables/release/useAppList";
import { currentAppId } from "@/shared/session/currentApp";

/** Every app the account reaches, as an M3 bottom sheet over whichever tab is open. */
const { t } = useI18n();
const { opened, close, choose } = useAppSwitcher();
const { choices } = useAppList();
</script>

<style>
.app-switcher.sheet-modal {
  height: auto;
  max-height: 80vh;
}

.app-switcher .app-switcher-content {
  max-height: calc(80vh - 28px);
  padding-bottom: calc(var(--f7-safe-area-bottom) + 16px);
}
</style>
