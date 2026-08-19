<template>
  <F7Page name="update-details">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      :title="item ? 'v' + item.version_name : 'Loading...'"
      back-link="Back"
      :sliding="false"
    ></F7Navbar>

    <div v-if="isLoading" class="flex items-center justify-center p-12">
      <F7Preloader></F7Preloader>
    </div>

    <div v-else-if="item" class="pb-safe">
      <F7Block
        strong
        class="no-margin-top rounded-b-2xl shadow-sm border-none bg-linear-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 p-8"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <F7Badge :color="item.active ? 'green' : 'gray'">{{
              item.active ? "Active" : "Inactive"
            }}</F7Badge>
            <F7Badge v-if="item.required" color="red">Required</F7Badge>
          </div>
          <span class="text-sm text-gray-400">{{
            formatDate(item.created_at)
          }}</span>
        </div>

        <h1 class="text-3xl font-black mb-1 tracking-tight">
          Version {{ item.version_name }}
        </h1>
        <p class="text-gray-500 mb-8 flex items-center gap-2 font-medium">
          <F7Icon :f7="getPlatformIcon(item.platform)" size="18" />
          {{ item.platform }} Project • {{ item.channel }}
        </p>

        <div class="grid grid-cols-2 gap-4">
          <F7Button
            fill
            large
            round
            color="blue"
            @click="downloadAsset"
            class="font-bold shadow-lg shadow-blue-500/20"
          >
            <F7Icon f7="arrow_down_circle_fill" size="20" class="mr-2" />
            Download
          </F7Button>
          <F7Button
            outline
            large
            round
            color="orange"
            @click="promote"
            class="font-bold border-2"
          >
            <F7Icon f7="zap_fill" size="20" class="mr-2" />
            Promote
          </F7Button>
        </div>
      </F7Block>

      <F7BlockTitle
        class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Release Notes</F7BlockTitle
      >
      <F7Block
        strong
        class="rounded-2xl mx-4 shadow-sm border-none bg-white dark:bg-gray-900"
      >
        <p class="text-sm leading-relaxed whitespace-pre-wrap opacity-70">
          {{
            item.release_notes || "No release notes provided for this version."
          }}
        </p>
      </F7Block>

      <F7BlockTitle
        class="mt-8 px-6 font-black text-xs uppercase tracking-widest opacity-40"
        >Metadata</F7BlockTitle
      >
      <F7List
        strong
        dividers-ios
        outline-ios
        class="no-margin-top rounded-2xl overflow-hidden shadow-sm mx-4"
      >
        <F7ListItem
          title="Version Code"
          :after="String(item.version_code || 'N/A')"
        ></F7ListItem>
        <F7ListItem
          title="File Size"
          :after="formatFileSize(item.file_size_bytes || 0)"
        ></F7ListItem>
        <F7ListItem
          title="Created By"
          :after="item.created_by || 'System'"
        ></F7ListItem>
        <F7ListItem title="Checksum" class="text-xs">
          <template #subtitle>
            <span class="font-mono break-all opacity-40">{{
              item.checksum || "No checksum available"
            }}</span>
          </template>
        </F7ListItem>
      </F7List>

      <F7Block class="mt-8 pb-12">
        <F7Button fill color="red" large outline round @click="confirmDelete"
          >Delete Version</F7Button
        >
      </F7Block>
    </div>
  </F7Page>
</template>

<script setup lang="ts">
import {
  useUpdateQuery,
  deleteBundle,
  promoteBundle,
} from "../queries/updates.queries";
import { useChannelsQuery } from "../../channels/queries/channels.queries";
import { useAppStore } from "@/shared/stores/app.store";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";

const isNavbarCollapsed = ref(false);

const props = defineProps<{
  id: string;
  f7route: any;
  f7router: any;
}>();

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);

const type = (props.f7route.query.type as "bundle" | "native") || "bundle";
const { data: item, isLoading, refetch } = useUpdateQuery(props.id, type);
const { data: channels } = useChannelsQuery(
  computed(() => activeApp.value?.app_id),
);

const getPlatformIcon = (p: string) => {
  if (p === "android") return "logo_android";
  if (p === "ios") return "logo_apple";
  return "globe";
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return "Unknown";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
};

const downloadAsset = () => {
  if (item.value?.download_url) {
    window.open(item.value.download_url, "_blank");
  } else {
    f7.dialog.alert("Download URL not available");
  }
};

const promote = () => {
  if (!item.value || !activeApp.value) return;

  if (type === "native") {
    f7.dialog.alert(
      "Native updates cannot be promoted directly. Upload a new version instead.",
      "Promotion",
    );
    return;
  }

  const buttons = (channels.value || [])
    .filter((c: any) => c.name !== item.value?.channel)
    .map((c: any) => ({
      text: `Promote to ${c.name}`,
      onClick: async () => {
        f7.preloader.show();
        try {
          await promoteBundle(props.id, activeApp.value!.app_id, c.name);
          f7.toast
            .create({ text: `Promoted to ${c.name}`, closeTimeout: 2000 })
            .open();
          await refetch();
        } catch (error: any) {
          f7.dialog.alert(error.message || "Promotion failed");
        } finally {
          f7.preloader.hide();
        }
      },
    }));

  if (buttons.length === 0) {
    f7.dialog.alert("No other channels available to promote to.");
    return;
  }

  f7.actions
    .create({ buttons: [...buttons, { text: "Cancel", color: "red" }] })
    .open();
};

const confirmDelete = () => {
  if (!item.value) return;
  f7.dialog.confirm(
    `Are you sure you want to delete this ${type} version?`,
    "Delete v" + (item.value?.version_name || ""),
    async () => {
      f7.preloader.show();
      try {
        if (type === "bundle") {
          await deleteBundle(props.id);
        } else {
          // Add deleteNativeUpdate if needed, but for now assuming same endpoint works or just bundles
          f7.dialog.alert("Native deletion coming soon");
          return;
        }
        f7.toast.create({ text: "Version deleted", closeTimeout: 2000 }).open();
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
