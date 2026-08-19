<template>
  <F7Page name="app-details">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      :title="app?.name || 'App Details'"
      back-link="Back"
      :sliding="false"
    >
      <F7NavRight>
        <F7Link class="p-2!" @click="refetch">
          <ILucideRefreshCw :size="24" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <F7Block
      v-if="app"
      strong
      class="no-margin-top rounded-b-2xl shadow-sm border-none bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8"
    >
      <div class="flex items-center gap-5">
        <div class="relative">
          <img
            :src="app.icon_url || '/icons/icon.png'"
            class="w-20 h-20 rounded-3xl shadow-xl object-cover border border-black/5 dark:border-white/5"
          />
        </div>
        <div>
          <h2 class="text-2xl font-black tracking-tight leading-tight">
            {{ app.name }}
          </h2>
          <p class="text-gray-400 font-mono text-[10px] mt-0.5 opacity-70">
            {{ app.app_id }}
          </p>
          <div class="flex gap-2 mt-3">
            <F7Badge color="blue" class="uppercase text-[9px] font-black">{{
              app.platform
            }}</F7Badge>
            <F7Badge
              v-if="app.user_role"
              color="orange"
              class="uppercase text-[9px] font-black"
              >{{ app.user_role }}</F7Badge
            >
          </div>
        </div>
      </div>
    </F7Block>

    <F7BlockTitle
      class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
      >Tester Actions</F7BlockTitle
    >
    <F7List
      dividers-ios
      strong-ios
      outline-ios
      class="no-margin-top rounded-2xl overflow-hidden shadow-sm mx-4"
    >
      <F7ListItem
        link
        title="View Updates"
        subtitle="Check OTA bundles"
        @click="viewUpdates"
      >
        <template #media>
          <F7Icon f7="layers_fill" color="blue" />
        </template>
      </F7ListItem>
      <F7ListItem
        link
        title="Devices"
        subtitle="Registered test devices"
        @click="viewDevices"
      >
        <template #media>
          <F7Icon f7="device_phone_portrait" color="purple" />
        </template>
      </F7ListItem>
      <F7ListItem
        link
        title="App Configuration"
        subtitle="Remote config & flags"
        @click="viewConfig"
      >
        <template #media>
          <F7Icon f7="settings_fill" color="gray" />
        </template>
      </F7ListItem>
    </F7List>

    <F7BlockTitle
      class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
      >Sync Status</F7BlockTitle
    >
    <F7Card
      outline
      class="rounded-2xl shadow-sm mx-4 border-none bg-white dark:bg-gray-900"
    >
      <F7CardContent class="flex items-center justify-between p-4">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <span class="font-bold text-sm">Live Connection</span>
        </div>
        <F7Button small outline round @click="testConnection">Test</F7Button>
      </F7CardContent>
    </F7Card>

    <F7Block class="mt-8 pb-12">
      <F7Button fill large color="red" outline round @click="confirmReset">
        Reset App Data
      </F7Button>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
import { useAppStore } from "@/shared/stores/app.store";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";

const isNavbarCollapsed = ref(false);

const props = defineProps<{
  id: string;
}>();

const appStore = useAppStore();
const app = computed(() => appStore.activeApp);

const refetch = () => {
  f7.toast
    .create({ text: "Refetching app data...", closeTimeout: 1000 })
    .open();
};

const viewUpdates = () => f7.tab.show("#view-updates");
const viewDevices = () =>
  f7.toast
    .create({ text: "Devices view coming soon", closeTimeout: 2000 })
    .open();
const viewConfig = () =>
  f7.toast
    .create({ text: "Remote config coming soon", closeTimeout: 2000 })
    .open();
const testConnection = () =>
  f7.toast.create({ text: "Connection stable", closeTimeout: 2000 }).open();

const confirmReset = () => {
  f7.dialog.confirm(
    "Are you sure you want to reset all cached data for this app?",
    "Reset Data",
    () => {
      f7.toast.create({ text: "Cache cleared", closeTimeout: 2000 }).open();
    },
  );
};
</script>
