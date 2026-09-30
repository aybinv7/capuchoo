<script setup lang="ts">
import { Smartphone } from "@lucide/vue";
import { computed, defineAsyncComponent, ref } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { orderChannels } from "@/shared/lib/channels";
import { formatCount } from "@/shared/lib/format";
import { useCatalog } from "@/shared/queries/useCatalog";
import AssignChannelDialog from "../components/AssignChannelDialog.vue";
import DevicesTable from "../components/DevicesTable.vue";
import DevicesToolbar from "../components/DevicesToolbar.vue";
import RemoveDeviceDialog from "../components/RemoveDeviceDialog.vue";
import { useDeviceMutations } from "../composables/useDeviceMutations";
import { useDevices } from "../composables/useDevices";
import type { Device, DeviceFilters } from "../types/devices.types";

const DevicesMap = defineAsyncComponent(() => import("../components/DevicesMap.vue"));

const { appId } = useCurrentApp();
const { channels } = useCatalog(appId);
const filters = ref<DeviceFilters>({ search: "", channelId: "", activeDays: "" });
const view = ref<"table" | "map">("table");
const {
  devices,
  total,
  located,
  isPending,
  isFetching,
  error,
  refetch,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
} = useDevices(appId, filters);
const mutations = useDeviceMutations(appId);

const orderedChannels = computed(() => orderChannels(channels.value).map((row) => row.channel));
const filtered = computed(() =>
  Boolean(filters.value.search || filters.value.channelId || filters.value.activeDays),
);

const selected = ref<Device | null>(null);
const assignOpen = ref(false);
const removeOpen = ref(false);

function assign(device: Device) {
  selected.value = device;
  assignOpen.value = true;
}

function remove(device: Device) {
  selected.value = device;
  removeOpen.value = true;
}

function loadMore() {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Devices"
      description="Installations that have checked for updates, newest activity first."
    >
      <template #badges>
        <span class="text-muted-foreground font-mono text-sm font-normal">
          {{ formatCount(total, true) }}
        </span>
        <Spinner v-if="isFetching && !isPending" class="text-muted-foreground size-3.5" />
      </template>
    </PageHeader>

    <DevicesToolbar
      v-model="filters"
      v-model:view="view"
      :channels="orderedChannels"
      :located="located.length"
    />

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <div v-else-if="isPending" class="space-y-2">
      <Skeleton v-for="index in 8" :key="index" class="h-12 w-full" />
    </div>
    <EmptyState
      v-else-if="devices.length === 0"
      :icon="Smartphone"
      :title="filtered ? 'No device matches' : 'No device has checked in yet'"
      :description="
        filtered
          ? 'Clear the filters or widen the time window.'
          : 'Devices appear after their first update check against this server.'
      "
    />
    <template v-else-if="view === 'map'">
      <p class="text-muted-foreground text-xs">
        {{ located.length }} of the {{ devices.length }} loaded devices reported a location. Devices
        without one are not placed.
      </p>
      <DevicesMap :devices="located" />
    </template>
    <DevicesTable v-else :devices="devices" @assign="assign" @remove="remove" @reach-end="loadMore">
      <template #footer>
        <div
          v-if="isFetchingNextPage"
          class="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs"
        >
          <Spinner class="size-3" />
          Loading more devices
        </div>
      </template>
    </DevicesTable>

    <AssignChannelDialog
      v-model:open="assignOpen"
      :device="selected"
      :channels="channels"
      :assign="mutations.assign"
    />
    <RemoveDeviceDialog v-model:open="removeOpen" :device="selected" :remove="mutations.remove" />
  </PageContainer>
</template>
