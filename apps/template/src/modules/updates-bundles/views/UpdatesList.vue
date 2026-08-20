<template>
  <F7Page ptr @ptr:refresh="handleRefresh">
    <F7Navbar
      @navbar:collapse="isNavbarCollapsed = true"
      @navbar:expand="isNavbarCollapsed = false"
      large
      transparent
      title="Updates & Bundles"
      :sliding="false"
    >
      <F7Subnavbar :bg-color="!isNavbarCollapsed ? 'transparent' : ''" :inner="false">
        <F7Searchbar
          class="search-updates"
          :custom-search="true"
          :disable-button="true"
          placeholder="Search updates..."
          :clear-button="true"
          :backdrop="false"
          @searchbar:search="handleSearch"
          @searchbar:clear="clearSearch"
        />
      </F7Subnavbar>

      <F7NavRight>
        <F7Link class="p-2!" @click="createUpdate">
          <ILucidePlusCircle :size="28" />
        </F7Link>
      </F7NavRight>
    </F7Navbar>

    <div v-if="isLoading" class="flex items-center justify-center p-12">
      <F7Preloader />
    </div>

    <F7List v-else media-list class="updates-list mt-0!">
      <F7ListItem
        v-for="item in filteredUpdates"
        :key="item.id"
        :title="'v' + item.version_name"
        :subtitle="item.channel"
        :text="item.release_notes || 'No release notes'"
        :after="formatDate(item.created_at)"
        link
        @click="viewDetails(item.id)"
      >
        <template #media>
          <div class="flex flex-col items-center gap-1 w-12">
            <F7Icon
              :f7="getPlatformIcon(item.platform)"
              :color="getPlatformColor(item.platform)"
              size="24"
            />
            <span class="text-[9px] uppercase font-bold opacity-40 leading-none">{{
              item.platform
            }}</span>
          </div>
        </template>
        <template #after-title>
          <F7Badge v-if="item.required" color="red" class="ml-1">REQ</F7Badge>
        </template>
      </F7ListItem>

      <F7ListItem
        v-if="!filteredUpdates.length"
        :title="searchQuery ? 'No results found' : 'No updates found'"
        :text="
          searchQuery
            ? 'Try a different search term.'
            : 'Select an app or create a new bundle to get started.'
        "
      ></F7ListItem>
    </F7List>
  </F7Page>
</template>

<script setup lang="ts">
import { useUpdatesQuery } from "../queries/updates.queries";
import { f7 } from "framework7-vue";
import { computed, ref } from "vue";
import { useAppStore } from "@/shared/stores/app.store";

const appStore = useAppStore();
const activeApp = computed(() => appStore.activeApp);
const isNavbarCollapsed = ref(false);
const searchQuery = ref("");

const {
  data: updatesData,
  isLoading,
  refetch,
} = useUpdatesQuery(computed(() => activeApp.value?.app_id));
const updates = computed(() => updatesData.value || []);

const filteredUpdates = computed(() => {
  if (!searchQuery.value) return updates.value;
  const q = searchQuery.value.toLowerCase();
  return updates.value.filter(
    (u) =>
      u.version_name.toLowerCase().includes(q) ||
      u.channel.toLowerCase().includes(q) ||
      (u.release_notes && u.release_notes.toLowerCase().includes(q)),
  );
});

const getPlatformIcon = (p: string) => {
  if (p === "android") return "logo_android";
  if (p === "ios") return "logo_apple";
  return "globe";
};

const getPlatformColor = (p: string) => {
  if (p === "android") return "green";
  if (p === "ios") return "blue";
  return "gray";
};

const formatDate = (d: string) => {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const props = defineProps<{
  f7router: any;
}>();

const viewDetails = (id: string) => {
  const item = updates.value.find((u) => u.id === id);
  const type = item?.type || "bundle";
  props.f7router.navigate(`/updates-bundles/${id}?type=${type}`);
};

const handleSearch = (_sb: any, query: string) => {
  searchQuery.value = query;
};

const clearSearch = () => {
  searchQuery.value = "";
};

const handleRefresh = async (done: () => void) => {
  await refetch();
  done();
};

const createUpdate = () => {
  (f7.toast as any).create({ text: "Creation coming soon!", closeTimeout: 2000 }).open();
};
</script>

<style lang="less">
.updates-list {
  .item-media {
    padding-top: 12px;
    padding-bottom: 12px;
  }
}
</style>
