<template>
  <F7Page name="settings-app" ptr @ptr:refresh="handleRefresh">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      :title="activeApp?.name || 'App Settings'"
      back-link="Back"
      :sliding="false"
    ></F7Navbar>
    <div v-if="activeApp" class="pb-safe">
      <F7Block
        strong
        class="no-margin-top border-none bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8 rounded-b-2xl shadow-sm"
      >
        <F7List no-hairlines-md class="no-margin">
          <F7ListInput label="App Name" type="text" :value="activeApp.name"></F7ListInput>
          <F7ListInput
            label="Bundle ID"
            type="text"
            :value="activeApp.app_id"
            disabled
          ></F7ListInput>
          <F7ListItem title="Platform" :after="activeApp.platform.toUpperCase()"></F7ListItem>
        </F7List>
        <F7Button fill large round color="blue" class="mt-6 font-bold shadow-lg shadow-blue-500/20"
          >Update Project</F7Button
        >
      </F7Block>

      <F7BlockTitle class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Danger Zone</F7BlockTitle
      >
      <F7Block
        strong
        class="rounded-2xl border-2 border-red-500/20 mx-4 bg-red-50/10 dark:bg-red-950/10"
      >
        <p class="text-xs text-red-500 mb-6 font-medium leading-relaxed">
          Deleting this app will permanently remove all associated updates, bundles, and analytics
          data. This action cannot be undone.
        </p>
        <F7Button fill color="red" round large outline class="font-bold"
          >Delete App Permanently</F7Button
        >
      </F7Block>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import { useAppStore } from "@/shared/stores/app.store";
import { computed, ref } from "vue";

const isNavbarCollapsed = ref(false);

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);

const handleRefresh = async (done: () => void) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  done();
};
</script>
