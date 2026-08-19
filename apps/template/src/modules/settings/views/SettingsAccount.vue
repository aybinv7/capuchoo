<template>
  <F7Page name="settings-account">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="Account Settings"
      back-link="Back"
      :sliding="false"
    />
    <F7Block
      strong
      class="no-margin-top border-none bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8 rounded-b-2xl shadow-sm"
    >
      <div class="flex flex-col gap-4">
        <F7List no-hairlines-md class="no-margin">
          <F7ListInput
            label="Full Name"
            type="text"
            placeholder="Your name"
            :value="user?.user_metadata?.full_name"
          ></F7ListInput>
          <F7ListInput
            label="Email"
            type="email"
            :value="user?.email"
            disabled
          ></F7ListInput>
        </F7List>
        <F7Button
          fill
          large
          round
          color="blue"
          class="mt-4 font-bold shadow-lg shadow-blue-500/20"
          >Save Changes</F7Button
        >
      </div>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/shared/stores/auth.store";
import { computed, ref } from "vue";

const isNavbarCollapsed = ref(false);

const authStore = useAuthStore();
const user = computed(() => authStore.user);
</script>
