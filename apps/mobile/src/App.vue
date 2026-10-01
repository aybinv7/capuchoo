<template>
  <F7App v-bind="parameters">
    <F7View
      v-if="!signedIn"
      key="signed-out"
      main
      class="safe-areas"
      :url="hasOnboarded ? '/sign-in/' : '/welcome/'"
    />

    <F7Views v-else key="signed-in" tabs class="safe-areas cap-shell">
      <CapTabbar :badges="badges" />

      <F7View
        v-for="(tab, index) in tabs"
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
import { tabs } from "@/app/tabs";
import { countUnread } from "@/domains/activity/activity.repository";
import { initCapacitor } from "@/plugins/capacitor";
import { hideSplashScreen } from "@/plugins/capacitor/useSplashScreen";
import { framework7Parameters } from "@/plugins/framework7.plugin";
import CapTabbar from "@/shared/components/navigation/CapTabbar.vue";
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { useAppThemeProvider } from "@/shared/composables/theme/useAppTheme";
import { startColorTheme } from "@/shared/composables/theme/useColorTheme";
import { hasOnboarded } from "@/shared/session/onboarding";
import { session } from "@/shared/session/session";
import { startSession } from "@/shared/sync/useSync";

const appTheme = useAppThemeProvider();
const parameters = framework7Parameters(appTheme.value.dark);

const signedIn = computed(() => session.value !== null);

const unreadQuery = useReactiveQuery(() => countUnread(getDatabase().db), {
  tables: ["activity"],
  queryKey: ["activity:unread"],
});
const badges = computed(() => {
  const unread = unreadQuery.data.value ?? 0;
  return { activity: unread > 99 ? "99+" : unread };
});

watch(
  signedIn,
  (now) => {
    if (now) {
      markTabShown("view-apps");
      void startSession();
    }
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
