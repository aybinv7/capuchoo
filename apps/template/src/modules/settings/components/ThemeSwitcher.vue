<template>
  <F7List dividers-ios strong-ios outline-ios>
    <F7ListItem
      title="Appearance"
      smart-select
      :smart-select-params="{ openIn: 'popover' }"
    >
      <template #media>
        <f7-icon f7="moon_stars_fill" color="purple" />
      </template>
      <select
        :value="store.darkMode ? 'dark' : 'light'"
        @change="onAppearanceChange"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </F7ListItem>

    <F7ListItem title="Notifications">
      <template #media>
        <f7-icon f7="bell_fill" color="red" />
      </template>
      <template #after>
        <F7Toggle
          :checked="store.notificationsEnabled"
          @change="store.toggleNotifications"
        />
      </template>
    </F7ListItem>
  </F7List>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/modules/settings/stores/settings.store";

const store = useSettingsStore();

const onAppearanceChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  store.setDarkMode(target.value === "dark");
};
</script>
