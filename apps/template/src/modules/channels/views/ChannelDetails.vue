<template>
  <F7Page name="channel-details">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      :title="channel?.name || 'Channel Details'"
      back-link="Back"
      :sliding="false"
    >
      <F7NavRight>
        <F7Link class="p-2!" @click="confirmEdit">
          <ILucideEdit3 :size="24" />
        </F7Link>
        <F7Link class="p-2!" @click="refetch">
          <ILucideRefreshCw :size="24" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <div v-if="isLoading" class="flex items-center justify-center p-12">
      <F7Preloader></F7Preloader>
    </div>

    <div v-else-if="channel" class="pb-safe">
      <F7Block
        strong
        class="no-margin-top rounded-b-2xl shadow-sm border-none bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8"
      >
        <div class="flex items-center gap-5">
          <div
            class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            :class="getChannelBg(channel.name)"
          >
            <ILucideRadio :size="32" class="text-white" />
          </div>
          <div>
            <h2 class="text-2xl font-black tracking-tight leading-tight">
              {{ channel.name }}
            </h2>
            <p class="text-gray-500 text-sm mt-1">
              {{ channel.description || "Active delivery channel" }}
            </p>
          </div>
        </div>
      </F7Block>

      <F7BlockTitle
        class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Deployment Status</F7BlockTitle
      >
      <F7List
        dividers-ios
        strong-ios
        outline-ios
        class="no-margin-top rounded-2xl overflow-hidden shadow-sm mx-4"
      >
        <F7ListItem title="Status">
          <template #after>
            <F7Toggle :checked="channel.active" @change="toggleActive" />
          </template>
        </F7ListItem>
        <F7ListItem
          title="Current Version"
          :after="channel.version_name || 'None'"
        ></F7ListItem>
        <F7ListItem
          title="Last Update"
          :after="formatDate(channel.updated_at)"
        ></F7ListItem>
      </F7List>

      <F7BlockTitle
        class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Configuration</F7BlockTitle
      >
      <F7List
        dividers-ios
        strong-ios
        outline-ios
        class="no-margin-top rounded-2xl overflow-hidden shadow-sm mx-4"
      >
        <F7ListItem title="Public Access">
          <template #after>
            <F7Toggle :checked="true" />
          </template>
        </F7ListItem>
        <F7ListItem title="Auto-Promote">
          <template #after>
            <F7Toggle :checked="false" />
          </template>
        </F7ListItem>
      </F7List>

      <F7Block class="mt-8 pb-12">
        <F7Button fill large color="red" outline round @click="confirmDelete">
          Delete Channel
        </F7Button>
      </F7Block>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";
import {
  useChannelsQuery,
  deleteChannel,
  updateChannel,
} from "../queries/channels.queries";
import { useAppStore } from "@/shared/stores/app.store";

const props = defineProps<{
  id: string;
  f7router: any;
}>();

const isNavbarCollapsed = ref(false);
const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);

const {
  data: channels,
  isLoading,
  refetch,
} = useChannelsQuery(computed(() => activeApp.value?.app_id));
const channel = computed(() =>
  channels.value?.find((c: any) => c.id === props.id),
);

const getChannelBg = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("prod")) return "bg-red-500";
  if (n.includes("stage")) return "bg-orange-500";
  if (n.includes("dev")) return "bg-blue-500";
  return "bg-gray-500";
};

const formatDate = (date: string) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const toggleActive = async (e: any) => {
  if (!channel.value) return;
  const active = e.target.checked;
  f7.preloader.show();
  try {
    await updateChannel(props.id, { active });
    f7.toast.create({ text: "Status updated", closeTimeout: 2000 }).open();
    await refetch();
  } catch (error: any) {
    f7.dialog.alert(error.message || "Update failed");
  } finally {
    f7.preloader.hide();
  }
};

const confirmEdit = () => {
  if (!channel.value) return;
  f7.dialog.prompt(
    "Update channel name:",
    "Edit Channel",
    async (newName) => {
      if (!newName || newName === channel.value.name) return;
      f7.preloader.show();
      try {
        await updateChannel(props.id, { name: newName });
        f7.toast.create({ text: "Channel updated", closeTimeout: 2000 }).open();
        await refetch();
      } catch (error: any) {
        f7.dialog.alert(error.message || "Update failed");
      } finally {
        f7.preloader.hide();
      }
    },
    channel.value.name,
  );
};

const confirmDelete = () => {
  if (!channel.value) return;
  f7.dialog.confirm(
    `Are you sure you want to delete the channel '${channel.value.name}'?`,
    "Delete Channel",
    async () => {
      f7.preloader.show();
      try {
        await deleteChannel(props.id);
        f7.toast.create({ text: "Channel deleted", closeTimeout: 2000 }).open();
        props.f7router.back();
      } catch (error: any) {
        f7.dialog.alert(error.message || "Delete failed");
      } finally {
        f7.preloader.hide();
      }
    },
  );
};
</script>
