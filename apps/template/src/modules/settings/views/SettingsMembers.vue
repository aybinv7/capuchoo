<template>
  <F7Page name="settings-members" ptr @ptr:refresh="handleRefresh">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="Team Members"
      back-link="Back"
      :sliding="false"
    >
      <F7NavRight>
        <F7Link class="p-2!" @click="inviteMember">
          <ILucidePlusCircle :size="28" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <F7List
      v-if="activeApp"
      dividers-ios
      strong-ios
      outline-ios
      class="no-margin-top mt-0! rounded-2xl overflow-hidden shadow-sm mx-4"
    >
      <F7ListItem title="Me" subtitle="Owner" after="Admin">
        <template #media>
          <F7Icon f7="person_circle_fill" color="blue" />
        </template>
      </F7ListItem>
    </F7List>
  </F7Page>
</template>

<script setup lang="ts">
import { useAppStore } from "@/shared/stores/app.store";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";

const isNavbarCollapsed = ref(false);

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);

const handleRefresh = async (done: () => void) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  done();
};

const inviteMember = () => {
  f7.dialog.prompt("Enter email address:", "Invite Member", (email) => {
    f7.toast.create({ text: `Invited ${email}`, closeTimeout: 2000 }).open();
  });
};
</script>
