<template>
  <F7Page name="settings-api-keys">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="API Keys"
      back-link="Back"
      :sliding="false"
    />
    <F7Block
      strong
      class="no-margin-top border-none bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8 rounded-b-2xl shadow-sm"
    >
      <p class="text-sm text-gray-500 mb-8 font-medium">
        Use these keys to authenticate your CI/CD pipelines and external integrations.
      </p>
      <F7List
        dividers-ios
        strong-ios
        outline-ios
        class="no-margin-top rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-gray-800"
      >
        <F7ListItem title="Main API Key">
          <template #subtitle>
            <span class="font-mono text-[10px] opacity-40">cap_live_xxxxxxxxxxxxxxxxxxxx</span>
          </template>
          <template #after>
            <F7Link class="p-2!" @click="copyKey">
              <ILucideCopy :size="18" />
            </F7Link>
          </template>
        </F7ListItem>
      </F7List>
      <F7Button fill large round color="blue" class="mt-8 font-bold shadow-lg shadow-blue-500/20"
        >Generate New Key</F7Button
      >
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
import { f7 } from "framework7-vue";
import { ref } from "vue";

const isNavbarCollapsed = ref(false);

const copyKey = () => {
  f7.toast.create({ text: "API Key copied!", closeTimeout: 2000 }).open();
};
</script>
