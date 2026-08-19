<template>
  <F7Page name="channels-list" ptr @ptr:refresh="handleRefresh">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="App Channels"
      :sliding="false"
    >
      <F7NavRight>
        <F7Link class="p-2!" @click="addChannel">
          <ILucidePlusCircle :size="28" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <div v-if="isLoading" class="flex items-center justify-center p-8">
      <f7-preloader></f7-preloader>
    </div>

    <F7List v-else media-list class="no-margin-top mt-0!">
      <F7ListItem
        v-for="channel in channels"
        :key="channel.id"
        :title="channel.name"
        :subtitle="'Active Version: ' + (channel.version_name || 'None')"
        :link="'/channels/' + channel.id"
      >
        <template #media>
          <F7Icon
            f7="antenna_radiowaves_left_right"
            :color="getChannelColor(channel.name)"
          />
        </template>
        <template #after>
          <F7Badge :color="channel.active ? 'green' : 'gray'">{{
            channel.active ? "LIVE" : "IDLE"
          }}</F7Badge>
        </template>
        <template #text>
          {{ channel.description || "Channel for delivery and testing." }}
        </template>
      </F7ListItem>

      <F7ListItem
        v-if="!channels.length"
        title="No channels found"
        text="Channels are used to target different environments like production, staging, and development."
      ></F7ListItem>
    </F7List>
  </F7Page>
</template>

<script setup lang="ts">
import { useAppStore } from "@/shared/stores/app.store";
import {
  useChannelsQuery,
  useCreateChannelMutation,
} from "../queries/channels.queries";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);
const isNavbarCollapsed = ref(false);

const {
  data: channelsData,
  isLoading,
  refetch,
} = useChannelsQuery(computed(() => activeApp.value?.app_id));
const channels = computed(() => channelsData.value || []);

const createMutation = useCreateChannelMutation();

const handleRefresh = async (done: () => void) => {
  await refetch();
  done();
};

const getChannelColor = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("prod")) return "red";
  if (n.includes("stage")) return "orange";
  if (n.includes("dev")) return "blue";
  return "gray";
};

const addChannel = () => {
  if (!activeApp.value) {
    f7.dialog.alert("Please select an app first.");
    return;
  }

  f7.dialog.prompt(
    "Enter the new channel name (e.g., 'staging'):",
    "Create Channel",
    async (name) => {
      if (!name) return;

      f7.preloader.show();
      try {
        await createMutation.mutateAsync({
          name,
          app_id: activeApp.value?.app_id,
          active: true,
        });
        f7.toast
          .create({ text: `Channel '${name}' created!`, closeTimeout: 2000 })
          .open();
        await refetch();
      } catch (error: any) {
        f7.dialog.alert(error.message || "Failed to create channel", "Error");
      } finally {
        f7.preloader.hide();
      }
    },
  );
};
</script>
