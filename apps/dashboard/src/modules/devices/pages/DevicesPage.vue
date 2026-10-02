<script setup lang="ts">
import { Map as MapIcon, Smartphone, TableProperties } from "@lucide/vue";
import type { ColumnFiltersState } from "@tanstack/vue-table";
import { computed, defineAsyncComponent, ref } from "vue";
import { useRouter } from "vue-router";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { orderChannels } from "@/shared/lib/channels";
import { formatCount } from "@/shared/lib/format";
import { useCatalog } from "@/shared/queries/useCatalog";
import { RouteName } from "@/shared/router/route-names";
import AssignChannelDialog from "../components/AssignChannelDialog.vue";
import DevicesTable from "../components/DevicesTable.vue";
import RemoveDeviceDialog from "../components/RemoveDeviceDialog.vue";
import { useDeviceMutations } from "../composables/useDeviceMutations";
import { useDevices } from "../composables/useDevices";
import { toDeviceFilters } from "../lib/device-filters";
import type { Device } from "../types/devices.types";

const DevicesMap = defineAsyncComponent(() => import("../components/DevicesMap.vue"));

const router = useRouter();
const { appId, app } = useCurrentApp();
const { channels } = useCatalog(appId);
const search = useQueryParam("q", "");
const columnFilters = ref<ColumnFiltersState>([]);
const filters = computed(() => toDeviceFilters(search.value, columnFilters.value));
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
const neverSeen = computed(
  () =>
    !isPending.value &&
    total.value === 0 &&
    !filters.value.search &&
    !filters.value.channelId &&
    !filters.value.activeDays,
);

const selected = ref<Device | null>(null);
const assignOpen = ref(false);
const removeOpen = ref(false);

function open(device: Device) {
  void router.push({ name: RouteName.device, params: { deviceId: device.id } });
}

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

function setView(value: unknown) {
  if (value === "table" || value === "map") view.value = value;
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
      <template #actions>
        <ToggleGroup
          :model-value="view"
          type="single"
          variant="outline"
          size="sm"
          @update:model-value="setView"
        >
          <ToggleGroupItem value="table" aria-label="Table">
            <TableProperties />
            Table
          </ToggleGroupItem>
          <ToggleGroupItem
            value="map"
            aria-label="Map"
            :disabled="located.length === 0"
            :title="located.length === 0 ? 'No loaded device has reported a location' : undefined"
          >
            <MapIcon />
            Map
            <span class="text-muted-foreground font-mono text-[10px]">{{ located.length }}</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </template>
    </PageHeader>

    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <EmptyState
      v-else-if="neverSeen"
      :icon="Smartphone"
      title="No device has checked in yet"
      description="Devices appear after their first update check against this server."
    />
    <DevicesMap v-else-if="view === 'map'" :devices="located" @open="open" />
    <DevicesTable
      v-else
      v-model:search="search"
      v-model:filters="columnFilters"
      :devices="devices"
      :channels="orderedChannels"
      :total="total"
      :has-more="Boolean(hasNextPage)"
      :loading="isPending"
      :loading-more="isFetchingNextPage"
      :refreshing="isFetching && !isPending && !isFetchingNextPage"
      :app-name="app?.name ?? 'devices'"
      @open="open"
      @assign="assign"
      @remove="remove"
      @load-more="loadMore"
      @refresh="refetch"
    />

    <AssignChannelDialog
      v-model:open="assignOpen"
      :device="selected"
      :channels="channels"
      :assign="mutations.assign"
    />
    <RemoveDeviceDialog v-model:open="removeOpen" :device="selected" :remove="mutations.remove" />
  </PageContainer>
</template>
