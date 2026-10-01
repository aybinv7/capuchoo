<template>
  <F7App v-bind="parameters">
    <F7View v-if="!signedIn" key="signed-out" main class="safe-areas" url="/sign-in/" />

    <F7Views v-else key="signed-in" tabs class="safe-areas">
      <F7Toolbar tabbar icons bottom :class="{ 'tabbar-hidden': !isVisible }">
        <F7Link
          v-for="(tab, index) in tabs"
          :key="tab.id"
          :tab-link="`#view-${tab.id}`"
          :tab-link-active="index === 0"
          :icon-md="`material:${tab.icon}`"
          :badge="tab.id === 'activity' && unread ? (unread > 99 ? '99+' : unread) : undefined"
          :text="t(tab.labelKey)"
          @click="tick"
        />
      </F7Toolbar>

      <F7View
        v-for="(tab, index) in tabs"
        :id="`view-${tab.id}`"
        :key="tab.id"
        :main="index === 0"
        :tab="true"
        :tab-active="index === 0"
        :url="`/${tab.id}/`"
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
import { getDatabase, useReactiveQuery } from "@/shared/database";
import { useAppThemeProvider } from "@/shared/composables/theme/useAppTheme";
import { session } from "@/shared/session/session";
import { startSession } from "@/shared/sync/useSync";
import { tick } from "@/shared/utils/native/haptics";

const { t } = useI18n();
const { isVisible } = useTabbarVisibility();

const appTheme = useAppThemeProvider();
const parameters = framework7Parameters(appTheme.value.dark);

const signedIn = computed(() => session.value !== null);

const unreadQuery = useReactiveQuery(() => countUnread(getDatabase().db), {
  tables: ["activity"],
  queryKey: ["activity:unread"],
});
const unread = computed(() => unreadQuery.data.value ?? 0);

watch(
  signedIn,
  (now) => {
    if (now) void startSession();
  },
  { immediate: true },
);

onMounted(() => {
  f7ready(async (instance) => {
    useNavigationGuard();
    await initCapacitor(instance);
    hideSplashScreen();
  });
});
</script>
