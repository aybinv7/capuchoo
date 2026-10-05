<template>
  <F7App v-bind="parameters">
    <F7View
      v-if="!signedIn"
      key="signed-out"
      main
      class="safe-areas"
      :url="hasOnboarded ? '/sign-in/' : '/welcome/'"
    />

    <F7View v-else-if="!currentAppId" key="choose-app" main class="safe-areas" url="/choose-app/" />

    <F7View v-else-if="!app" key="loading-app" main class="safe-areas" url="/loading/" />

    <F7Views v-else :key="shellKey" tabs class="safe-areas cap-shell">
      <CapTabbar :tabs="visibleTabs" />
      <AppSwitcherSheet />
      <RolePreviewBanner />

      <F7View
        v-for="(tab, index) in visibleTabs"
        :id="`view-${tab.id}`"
        :key="tab.id"
        :main="index === 0"
        :tab="true"
        :tab-active="index === 0"
        :url="`/${tab.id}/`"
        @tab:show="(el: Element) => markTabShown(el.id)"
      />
    </F7Views>
  </F7App>
</template>

<script setup lang="ts">
import { tabsFor } from "@/app/tabs";
import { initCapacitor } from "@/plugins/capacitor";
import { hideSplashScreen } from "@/plugins/capacitor/useSplashScreen";
import { framework7Parameters } from "@/plugins/framework7.plugin";
import AppSwitcherSheet from "@/shared/components/navigation/AppSwitcherSheet.vue";
import CapTabbar from "@/shared/components/navigation/CapTabbar.vue";
import RolePreviewBanner from "@/shared/components/navigation/RolePreviewBanner.vue";
import { useCurrentApp } from "@/shared/composables/apps/useCurrentApp";
import { useAppThemeProvider } from "@/shared/composables/theme/useAppTheme";
import { startColorTheme } from "@/shared/composables/theme/useColorTheme";
import { currentAppId } from "@/shared/session/currentApp";
import { hasOnboarded } from "@/shared/session/onboarding";
import { session } from "@/shared/session/session";
import { startSession } from "@/shared/sync/useSync";

const appTheme = useAppThemeProvider();
const parameters = framework7Parameters(appTheme.value.dark);

const signedIn = computed(() => session.value !== null);

watch(
  signedIn,
  (now) => {
    if (now) void startSession();
  },
  { immediate: true },
);

const { app } = useCurrentApp();
const visibleTabs = computed(() => (app.value ? tabsFor(app.value) : []));

/**
 * The shell is rebuilt for another app or another set of tabs - a role preview changes which
 * there are - and opens on the first of them, whichever tab the last shell was left on.
 */
const shellKey = computed(
  () => `${currentAppId.value}:${visibleTabs.value.map((tab) => tab.id).join(",")}`,
);
watch(
  shellKey,
  () => {
    const first = visibleTabs.value[0];
    if (first) markTabShown(`view-${first.id}`);
  },
  { immediate: true },
);

/**
 * Each shell step is independent, so one failing must not take the next with it: a throw in the
 * colour theme would otherwise leave the back button unwired, with nothing on screen to say why.
 */
function runShellStep(name: string, step: () => void): void {
  try {
    step();
  } catch (error) {
    console.error(`[shell] ${name} failed to start`, error);
  }
}

onMounted(() => {
  f7ready(async (instance) => {
    runShellStep("navigation guard", useNavigationGuard);
    runShellStep("colour theme", startColorTheme);
    await initCapacitor(instance);
    hideSplashScreen();
  });
});
</script>
