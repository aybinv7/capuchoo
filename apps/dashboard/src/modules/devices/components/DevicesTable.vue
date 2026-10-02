<script setup lang="ts">
import { Bug, MonitorSmartphone, Pin } from "@lucide/vue";
import type { ColumnFiltersState } from "@tanstack/vue-table";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { DataTable, type DataTableFacet } from "@/shared/components/data-table";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import { RouteName } from "@/shared/router/route-names";
import type { Channel } from "@/shared/types/release";
import { deviceTitle } from "@/shared/devices/lib/device-title";
import { DEVICE_COLUMNS } from "../lib/device-columns";
import type { Device } from "../types/devices.types";
import AttributeChips from "@/shared/devices/components/AttributeChips.vue";
import DeviceRowActions from "./DeviceRowActions.vue";

const search = defineModel<string>("search", { required: true });
const filters = defineModel<ColumnFiltersState>("filters", { required: true });

const props = defineProps<{
  devices: readonly Device[];
  channels: readonly Channel[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  appName: string;
}>();
const emit = defineEmits<{
  open: [device: Device];
  assign: [device: Device];
  remove: [device: Device];
  loadMore: [];
  refresh: [];
}>();

const facets = computed<DataTableFacet[]>(() => [
  {
    columnId: "channel",
    title: "Channel",
    single: true,
    options: props.channels.map((channel) => ({ value: channel.id, label: channel.name })),
  },
  {
    columnId: "last_seen",
    title: "Last seen",
    single: true,
    options: [
      { value: "1", label: "In the last 24 hours" },
      { value: "7", label: "In the last 7 days" },
      { value: "30", label: "In the last 30 days" },
    ],
  },
]);
</script>

<template>
  <DataTable
    v-model:search="search"
    v-model:filters="filters"
    :data="props.devices"
    :columns="DEVICE_COLUMNS"
    :get-row-id="(device) => device.id"
    table-id="devices"
    :export-name="`${props.appName}-devices`"
    :facets="facets"
    :features="{ selection: true }"
    search-placeholder="Device id, custom id, model, name, attribute value"
    server-filtering
    :total="props.total"
    :has-more="props.hasMore"
    :loading="props.loading"
    :loading-more="props.loadingMore"
    refreshable
    :refreshing="props.refreshing"
    row-clickable
    @row-click="emit('open', $event)"
    @load-more="emit('loadMore')"
    @refresh="emit('refresh')"
  >
    <template #toolbar>
      <slot name="toolbar" />
    </template>
    <template #cell-device="{ row }">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <RouterLink
            :to="{ name: RouteName.device, params: { deviceId: row.id } }"
            class="truncate text-sm underline-offset-2 hover:underline"
            >{{ deviceTitle(row) }}</RouterLink
          >
          <MonitorSmartphone
            v-if="row.is_emulator"
            class="text-muted-foreground size-3.5 shrink-0"
            aria-label="Emulator"
          />
          <Bug
            v-if="row.is_prod === false"
            class="text-warning size-3.5 shrink-0"
            aria-label="Debug build"
          />
        </div>
        <div class="text-muted-foreground truncate font-mono text-[11px]" :title="row.device_id">
          {{ row.custom_id ?? row.device_id }}
        </div>
      </div>
    </template>
    <template #cell-attributes="{ row }">
      <AttributeChips :attributes="row.attributes" />
    </template>
    <template #cell-device_id="{ row }">
      <span class="font-mono text-[11px]">{{ row.device_id }}</span>
    </template>
    <template #cell-platform="{ row }">
      <div class="text-xs">
        <div class="font-mono uppercase">{{ row.platform }}</div>
        <div class="text-muted-foreground truncate">{{ row.version_os ?? "—" }}</div>
      </div>
    </template>
    <template #cell-ota="{ row }">
      <VersionTag kind="ota" :version="row.version_name" />
    </template>
    <template #cell-native="{ row }">
      <VersionTag kind="native" :version="row.version_builtin" :code="row.version_code" />
    </template>
    <template #cell-channel="{ row }">
      <div class="min-w-0 text-xs">
        <div class="flex items-center gap-1">
          <span class="truncate font-mono">{{
            row.channel_name ?? row.reported_channel ?? "unresolved"
          }}</span>
          <Pin
            v-if="row.assigned_channel_id"
            class="text-primary size-3 shrink-0"
            aria-label="Assigned from the dashboard"
          />
        </div>
        <div
          v-if="row.reported_channel && row.reported_channel !== row.channel_name"
          class="text-muted-foreground truncate"
        >
          build says {{ row.reported_channel }}
        </div>
      </div>
    </template>
    <template #cell-emulator="{ row }">
      <span class="text-xs">{{ row.is_emulator ? "Yes" : "No" }}</span>
    </template>
    <template #cell-last_seen="{ row }">
      <span class="text-muted-foreground text-xs"><RelativeTime :value="row.last_seen_at" /></span>
    </template>
    <template #cell-first_seen="{ row }">
      <span class="text-muted-foreground text-xs"><RelativeTime :value="row.created_at" /></span>
    </template>
    <template #cell-actions="{ row }">
      <DeviceRowActions :device="row" @assign="emit('assign', row)" @remove="emit('remove', row)" />
    </template>
  </DataTable>
</template>
