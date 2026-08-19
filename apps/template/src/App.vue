<template>
  <F7App v-bind="f7Params">
    <!-- Login View -->
    <F7View
      v-if="!isAuthenticated"
      name="login"
      main
      url="/auth/login"
      class="safe-areas"
      animate
    ></F7View>

    <!-- Main App (Tabs) -->
    <F7Views v-else tabs animated class="safe-areas">
      <F7View name="home" id="view-home" main tab tab-active url="/"></F7View>
      <F7View
        name="updates"
        id="view-updates"
        tab
        url="/updates-bundles"
      ></F7View>
      <F7View name="channels" id="view-channels" tab url="/channels"></F7View>
      <F7View name="settings" id="view-settings" tab url="/settings"></F7View>

      <F7Toolbar tabbar icons bottom class="toolbar-main-app">
        <div class="toolbar-pane">
          <F7Link
            tab-link="#view-home"
            tab-link-active
            icon-ios="f7:house_fill"
            icon-md="material:home"
            text="Home"
            ripple-color="transparent"
          />
          <F7Link
            tab-link="#view-updates"
            icon-ios="f7:layers_fill"
            icon-md="material:layers"
            text="Updates"
            ripple-color="transparent"
          />
          <F7Link
            tab-link="#view-channels"
            icon-ios="f7:antenna_radiowaves_left_right"
            icon-md="material:router"
            text="Channels"
            ripple-color="transparent"
          />
          <F7Link
            tab-link="#view-settings"
            icon-ios="f7:gear_alt_fill"
            icon-md="material:settings"
            text="Settings"
            ripple-color="transparent"
          />
        </div>
      </F7Toolbar>
    </F7Views>

    <UpdatePrompt />
  </F7App>
</template>

<script setup lang="ts">
import type Framework7 from "framework7";
import UpdatePrompt from "./shared/components/updater/UpdatePrompt.vue";
import { useAuthStore } from "./shared/stores/auth.store";

const device = getDevice();
const f7Params = framework7();
const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);

onMounted(async () => {
  // Initialize Auth Store (Check session)
  await authStore.init();

  f7ready(async (f7: Framework7) => {
    if (device.capacitor) {
      await capacitorPlugin.init(f7);
    }
  });
});
</script>
