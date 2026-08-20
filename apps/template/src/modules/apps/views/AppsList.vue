<template>
  <F7Page name="apps">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="My Apps"
      :sliding="false"
    >
      <F7NavRight>
        <F7Link class="p-2!" @click="createNewApp">
          <ILucidePlusCircle :size="28" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <F7Searchbar
      disable-button-text="Cancel"
      placeholder="Search apps..."
      :clear-button="true"
      :backdrop="false"
      class="mt-0!"
    ></F7Searchbar>

    <div v-if="isLoading" class="flex items-center justify-center p-8">
      <F7Preloader></F7Preloader>
    </div>

    <template v-else>
      <F7BlockTitle
        v-if="activeApp"
        class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Currently Testing</F7BlockTitle
      >
      <F7List
        v-if="activeApp"
        media-list
        dividers-ios
        strong-ios
        outline-ios
        class="no-margin-top mb-4 rounded-2xl overflow-hidden shadow-sm mx-4"
      >
        <F7ListItem
          :title="activeApp.name"
          :subtitle="activeApp.app_id"
          :text="`Platform: ${activeApp.platform}`"
          link="#"
          class="active-app-item"
        >
          <template #media>
            <img
              :src="activeApp.icon_url || '/icons/icon.png'"
              class="w-12 h-12 rounded-xl object-cover shadow-sm border border-black/5"
            />
          </template>
          <template #after>
            <F7Badge color="green">Active</F7Badge>
          </template>
        </F7ListItem>
      </F7List>

      <F7BlockTitle class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Available Apps</F7BlockTitle
      >
      <F7List
        media-list
        dividers-ios
        strong-ios
        outline-ios
        class="no-margin-top rounded-2xl overflow-hidden shadow-sm mx-4"
      >
        <F7ListItem
          v-for="app in otherApps"
          :key="app.id"
          :title="app.name"
          :subtitle="app.app_id"
          link="#"
          @click="selectApp(app)"
        >
          <template #media>
            <img
              :src="app.icon_url || '/icons/icon.png'"
              class="w-12 h-12 rounded-xl object-cover shadow-sm border border-black/5"
            />
          </template>
          <template #after>
            <F7Icon f7="chevron_right" size="16" class="opacity-30" />
          </template>
        </F7ListItem>

        <F7Block v-if="!apps.length" class="text-center text-gray-400 py-10">
          <F7Icon f7="square_stack_3d_up_slash" size="48" class="mb-4 opacity-20" />
          <p>No apps found.</p>
        </F7Block>
      </F7List>
    </template>
  </F7Page>
</template>

<script setup lang="ts">
import { useAppStore } from "@/shared/stores/app.store";
import { useOrganizationStore } from "@/shared/stores/organization.store";
import { useAppsQuery } from "@/shared/queries/apps.queries";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";
import type { App } from "@/shared/types/models";

const appStore = useAppStore();
const orgStore = useOrganizationStore();
const activeApp = computed(() => appStore.activeApp);
const isNavbarCollapsed = ref(false);

const { data: appsData, isLoading } = useAppsQuery(computed(() => orgStore.activeOrganization?.id));
const apps = computed(() => appsData.value || []);

const otherApps = computed(() => {
  return apps.value.filter((a) => a.id !== activeApp.value?.id);
});

const selectApp = (app: App) => {
  f7.dialog.confirm(`Switch to testing "${app.name}"?`, "Confirm Context Switch", () => {
    appStore.setActiveApp(app);
    f7.toast
      .create({
        text: `Context switched to ${app.name}`,
        closeTimeout: 2000,
      })
      .open();
  });
};

const createNewApp = () => {
  f7.toast.create({ text: "App creation coming soon!", closeTimeout: 2000 }).open();
};
</script>

<style scoped>
.active-app-item {
  --f7-list-item-bg-color: rgba(var(--f7-theme-color-rgb), 0.05);
}
</style>
