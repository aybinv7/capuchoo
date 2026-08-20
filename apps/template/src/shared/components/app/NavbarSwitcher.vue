<template>
  <div class="navbar-switcher-container cursor-pointer" @click="openSwitcher">
    <div
      class="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95 border border-transparent hover:border-black/5 select-none"
    >
      <div class="flex flex-col items-start leading-tight">
        <span class="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">
          {{ activeOrg?.name || "Select Context" }}
        </span>
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-bold truncate max-w-[140px]">
            {{ activeApp?.name || "Select App" }}
          </span>
          <F7Icon f7="chevron_down" size="14" class="opacity-30" />
        </div>
      </div>
    </div>

    <!-- Switcher Popover -->
    <F7Popover ref="popoverRef" class="switcher-popover rounded-2xl overflow-hidden shadow-2xl">
      <F7List dividers-ios strong-ios outline-ios class="no-margin !mt-0">
        <F7ListItem
          title="Organizations"
          group-title
          class="text-[10px]! uppercase tracking-widest font-black opacity-70 py-2"
        >
          <F7Link class="p-2 -mr-2" @click.stop="handleManualRefetch">
            <ILucideRefreshCw :size="14" :class="{ 'animate-spin': isRefreshing }" />
          </F7Link>
        </F7ListItem>

        <F7ListItem
          v-for="org in organizations || []"
          :key="org.id"
          :title="org.name"
          link
          @click="selectOrg(org)"
        >
          <template #media>
            <div
              class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center"
            >
              <F7Icon
                f7="building_2_fill"
                size="18"
                :color="activeOrg?.id === org.id ? 'blue' : 'gray'"
              />
            </div>
          </template>
          <template #after>
            <F7Icon v-if="activeOrg?.id === org.id" f7="checkmark_alt" size="16" color="blue" />
          </template>
        </F7ListItem>

        <F7ListItem
          title="Apps"
          group-title
          class="!text-[10px] uppercase tracking-widest font-black opacity-50 py-2 mt-2"
        ></F7ListItem>

        <F7ListItem
          v-for="app in apps || []"
          :key="app.id"
          :title="app.name"
          :subtitle="app.app_id"
          link
          @click="selectApp(app)"
        >
          <template #media>
            <div class="relative">
              <img
                :src="app.icon_url || '/icons/icon.png'"
                class="w-10 h-10 rounded-xl object-cover shadow-sm border border-black/5"
              />
              <div
                v-if="activeApp?.id === app.id"
                class="absolute -top-1 -right-1 bg-blue-500 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center"
              >
                <F7Icon f7="checkmark_alt" size="10" color="white" />
              </div>
            </div>
          </template>
        </F7ListItem>

        <F7ListItem
          v-if="!apps?.length"
          title="No apps in this org"
          class="opacity-50 italic text-sm"
        ></F7ListItem>
      </F7List>

      <F7Block class="no-margin-top pb-4 pt-4 px-4">
        <F7Button
          large
          fill
          round
          color="blue"
          href="/apps/create"
          popover-close
          class="font-bold shadow-lg shadow-blue-500/20"
        >
          <F7Icon f7="plus_circle_fill" size="20" class="mr-2" />
          Create New App
        </F7Button>
      </F7Block>
    </F7Popover>
  </div>
</template>

<script setup lang="ts">
import { useOrganizationStore } from "@/shared/stores/organization.store";
import { useAppStore } from "@/shared/stores/app.store";
import { useOrganizationsQuery, useAppsQuery } from "@/shared/queries/apps.queries";
import { computed, ref, onMounted } from "vue";
import type { Organization, App } from "@/shared/types/models";

const orgStore = useOrganizationStore();
const appStore = useAppStore();

const activeOrg = computed(() => orgStore.activeOrganization);
const activeApp = computed(() => appStore.activeApp);

const popoverRef = ref<any>(null);

// Fetch Orgs
const { data: organizations, refetch: refetchOrgs } = useOrganizationsQuery();

// Fetch Apps for current Org
const activeOrgId = computed(() => activeOrg.value?.id || "");
const { data: appsData, refetch: refetchApps } = useAppsQuery(activeOrgId);
const apps = computed(() => appsData.value || []);

const isRefreshing = ref(false);

const handleManualRefetch = async () => {
  if (isRefreshing.value) return;

  isRefreshing.value = true;
  try {
    await Promise.all([refetchOrgs(), refetchApps()]);
  } catch (err) {
    console.error("Failed to refetch context:", err);
  } finally {
    isRefreshing.value = false;
  }
};

const openSwitcher = (e: any) => {
  const target = e.currentTarget;
  if (popoverRef.value) {
    // Try both ref and selector approaches for robustness
    try {
      popoverRef.value.f7Popover().open(target);
    } catch (err) {
      import("framework7-vue").then(({ f7 }) => {
        f7.popover.open(".switcher-popover", target);
      });
    }
  }
};

const closeSwitcher = () => {
  if (popoverRef.value) {
    popoverRef.value.f7Popover().close();
  }
};

const selectOrg = (org: Organization) => {
  orgStore.setActiveOrganization(org as Organization);
};

const selectApp = (app: App) => {
  appStore.setActiveApp(app as App);
  closeSwitcher();
};

// Auto-select first org/app if none selected
onMounted(() => {
  const orgs = organizations.value;
  if (!activeOrg.value && orgs && orgs.length > 0) {
    orgStore.setActiveOrganization(orgs[0] ?? null);
  }
});
</script>

<style scoped>
.switcher-popover {
  width: 300px;
}
:deep(.list-group-title) {
  background: transparent !important;
}
</style>
