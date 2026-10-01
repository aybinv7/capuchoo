<template>
  <F7Page class="cap-page cap-pushed">
    <F7Navbar
      class="navbar-gradient"
      :title="t('profile.notifications')"
      back-link
      :sliding="true"
    />

    <F7BlockTitle>{{ t("profile.notifyAbout") }}</F7BlockTitle>
    <F7List v-if="apps.length" strong inset dividers media-list class="rounded-2xl!">
      <F7ListItem
        v-for="app in apps"
        :key="app.id"
        :title="app.name"
        :subtitle="t(`roles.name.${app.role}`)"
      >
        <template #media>
          <AppIcon
            :name="app.name"
            :bundle-id="app.bundle_id"
            :icon-url="app.icon_url"
            :size="40"
          />
        </template>
        <template #after>
          <F7Toggle
            :checked="Boolean(app.notify)"
            @toggle:change="(on: boolean) => setNotify(app.id, on)"
          />
        </template>
      </F7ListItem>
    </F7List>
    <F7BlockFooter>{{ t("profile.notificationsHint") }}</F7BlockFooter>
  </F7Page>
</template>

<script setup lang="ts">
import AppIcon from "@/shared/components/app/AppIcon.vue";
import { useProfile } from "../composables/useProfile";

useHiddenTabbar();
const { t } = useI18n();
const { profile, setNotify } = useProfile();
const apps = computed(() => profile.value?.apps ?? []);
</script>
