<template>
  <F7Page name="settings">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="Settings"
      :sliding="false"
    />

    <!-- Profile Header -->
    <F7Block
      strong
      class="no-margin-top rounded-b-2xl shadow-sm text-center py-8 border-none bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-4 border-white dark:border-gray-900 shadow-md"
        >
          <span class="text-3xl font-black text-primary">{{ initials }}</span>
        </div>
        <div>
          <h2 class="text-xl font-bold no-margin">
            {{
              authStore.user?.user_metadata?.full_name || authStore.user?.email
            }}
          </h2>
          <p
            class="text-xs text-gray-500 font-medium uppercase tracking-widest mt-1"
          >
            {{ authStore.userRole }}
          </p>
        </div>
      </div>
    </F7Block>

    <F7BlockTitle>Account</F7BlockTitle>
    <F7List
      dividers-ios
      strong-ios
      outline-ios
      class="no-margin-top rounded-2xl overflow-hidden shadow-sm"
    >
      <F7ListItem title="My Profile" link="/settings/account">
        <template #media>
          <ILucideUser :size="20" class="text-blue-500" />
        </template>
      </F7ListItem>
      <F7ListItem title="API Keys" link="/settings/api-keys">
        <template #media>
          <ILucideKey :size="20" class="text-orange-500" />
        </template>
      </F7ListItem>
    </F7List>

    <F7BlockTitle v-if="activeApp"
      >Current App: {{ activeApp.name }}</F7BlockTitle
    >
    <F7List
      v-if="activeApp"
      dividers-ios
      strong-ios
      outline-ios
      class="no-margin-top rounded-2xl overflow-hidden shadow-sm"
    >
      <F7ListItem title="General Settings" link="/settings/app">
        <template #media>
          <ILucideSettings :size="20" class="text-gray-500" />
        </template>
      </F7ListItem>
      <F7ListItem title="Team Members" link="/settings/members">
        <template #media>
          <ILucideUsers :size="20" class="text-green-500" />
        </template>
      </F7ListItem>
    </F7List>

    <F7BlockTitle>Interface Preferences</F7BlockTitle>
    <F7List
      dividers-ios
      strong-ios
      outline-ios
      class="no-margin-top rounded-2xl overflow-hidden shadow-sm"
    >
      <F7ListItem title="Appearance">
        <template #media>
          <ILucideMoon :size="20" class="text-purple-500" />
        </template>
        <template #after>
          <span class="text-sm mr-2 opacity-50">{{
            settingsStore.darkMode ? "Dark" : "Light"
          }}</span>
          <F7Toggle
            :checked="settingsStore.darkMode"
            @change="settingsStore.toggleDarkMode"
          />
        </template>
      </F7ListItem>

      <F7ListItem
        title="Platform Theme"
        smart-select
        :smart-select-params="{ openIn: 'popover' }"
      >
        <template #media>
          <ILucideSmartphone :size="20" class="text-gray-500" />
        </template>
        <select
          name="platform-theme"
          :value="settingsStore.f7Theme"
          @change="onThemeChange"
        >
          <option value="auto">Auto (Native)</option>
          <option value="ios">iOS Theme</option>
          <option value="md">Material Design (Android)</option>
        </select>
      </F7ListItem>
    </F7List>

    <F7BlockTitle>System</F7BlockTitle>
    <F7List
      dividers-ios
      strong-ios
      outline-ios
      class="no-margin-top rounded-2xl overflow-hidden shadow-sm"
    >
      <F7ListItem title="Notifications" link @click="openNotificationSettings">
        <template #media>
          <ILucideBell :size="20" class="text-red-500" />
        </template>
      </F7ListItem>
    </F7List>

    <F7Block class="mt-8 pb-4">
      <F7Button fill large color="red" outline @click="handleSignOut"
        >Sign Out</F7Button
      >
    </F7Block>

    <F7Block class="text-center text-gray-400 text-xs pb-10">
      <p>Capucho App v{{ appVersion }}</p>
      <p>© 2026 inventor7</p>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/shared/stores/auth.store";
import { useAppStore } from "@/shared/stores/app.store";
import { useSettingsStore } from "@/modules/settings/stores/settings.store";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";
const isNavbarCollapsed = ref(false);

const authStore = useAuthStore();
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const appVersion = __APP_VERSION__;

const activeApp = computed(() => appStore.activeApp);

const initials = computed(() => {
  const user = authStore.user;
  const name = user?.user_metadata?.full_name || user?.email || "?";
  return name.substring(0, 1).toUpperCase();
});

const handleSignOut = () => {
  f7.dialog.confirm(
    "Are you sure you want to sign out?",
    "Sign Out",
    async () => {
      await authStore.logout();
      f7.views.main.router.navigate("/auth/login", {
        reloadAll: true,
        transition: "f7-flip",
      });
    },
  );
};

const onThemeChange = (e: any) => {
  settingsStore.setF7Theme(e.target.value);
};

const openNotificationSettings = () => {
  f7.toast
    .create({ text: "Notification settings coming soon!", closeTimeout: 2000 })
    .open();
};
</script>
