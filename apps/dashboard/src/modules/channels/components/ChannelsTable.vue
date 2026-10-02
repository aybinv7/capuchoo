<script setup lang="ts">
import { CornerDownRight, Globe } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import AdoptionMeter from "@/shared/components/AdoptionMeter.vue";
import ChannelStatusBadges from "@/shared/components/ChannelStatusBadges.vue";
import { DataTable, type DataTableFacet } from "@/shared/components/data-table";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import GateButton from "@/shared/components/GateButton.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import type { DeliveryDialogController } from "@/shared/delivery/composables/useDeliveryDialogs";
import { channelCurrent } from "@/shared/delivery/lib/eligibility";
import { orderChannels } from "@/shared/lib/channels";
import { formatCount } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { Channel, ReleaseCatalog } from "@/shared/types/release";
import type { ChannelStats } from "@/shared/types/stats";
import { CHANNEL_COLUMNS, type ChannelTableRow } from "../lib/channel-columns";
import ChannelActionsMenu from "./ChannelActionsMenu.vue";

const search = defineModel<string>("search", { default: "" });

const props = defineProps<{
  catalog: ReleaseCatalog;
  health: ReadonlyMap<string, ChannelStats>;
  dialogs: DeliveryDialogController;
  loading: boolean;
  refreshing: boolean;
  appName: string;
}>();
const emit = defineEmits<{ delete: [channel: Channel]; refresh: [] }>();

const FACETS: DataTableFacet[] = [
  { columnId: "environment", title: "Environment" },
  { columnId: "kind", title: "Kind" },
  { columnId: "status", title: "Status" },
];

const permissions = useAppPermissions();
const router = useRouter();

const rows = computed<ChannelTableRow[]>(() =>
  orderChannels(props.catalog.channels).map((row) => ({
    ...row,
    current: channelCurrent(row.channel, props.catalog),
    stats: props.health.get(row.channel.id) ?? null,
  })),
);

function open(row: ChannelTableRow) {
  void router.push({ name: RouteName.channel, params: { channelId: row.channel.id } });
}
</script>

<template>
  <DataTable
    v-model:search="search"
    :data="rows"
    :columns="CHANNEL_COLUMNS"
    :get-row-id="(row) => row.channel.id"
    table-id="channels"
    :features="{ grouping: true }"
    :export-name="`${props.appName}-channels`"
    :facets="FACETS"
    search-placeholder="Channel or version"
    :loading="props.loading"
    refreshable
    :refreshing="props.refreshing"
    row-clickable
    :row-class="(row) => row.channel.paused && 'bg-danger-soft/20'"
    @row-click="open"
    @refresh="emit('refresh')"
  >
    <template #cell-channel="{ row }">
      <div class="flex items-center gap-2" :class="row.depth === 1 && 'pl-5'">
        <CornerDownRight v-if="row.depth === 1" class="text-muted-foreground size-3.5 shrink-0" />
        <RouterLink
          :to="{ name: RouteName.channel, params: { channelId: row.channel.id } }"
          class="truncate font-mono text-sm font-medium hover:underline"
          >{{ row.channel.name }}</RouterLink
        >
        <EnvBadge :environment="row.channel.environment" size="sm" />
        <Globe
          v-if="row.channel.public"
          class="text-muted-foreground size-3.5"
          aria-label="Public"
        />
        <ChannelStatusBadges :channel="row.channel" />
      </div>
    </template>
    <template #cell-environment="{ row }">
      <EnvBadge :environment="row.channel.environment" size="sm" />
    </template>
    <template #cell-kind="{ row }">
      <span class="text-xs">{{ row.channel.kind === "client" ? "Client" : "Release" }}</span>
    </template>
    <template #cell-status="{ row }">
      <span class="text-xs" :class="row.channel.paused && 'text-destructive'">{{
        row.channel.paused ? "Paused" : "Live"
      }}</span>
    </template>
    <template #cell-ota="{ row }">
      <VersionTag kind="ota" :version="row.current.bundle?.version_name" />
    </template>
    <template #cell-native="{ row }">
      <VersionTag
        kind="native"
        :version="row.current.native?.version_name"
        :code="row.current.native?.version_code"
      />
    </template>
    <template #cell-adoption="{ row }">
      <AdoptionMeter
        v-if="row.stats && row.stats.devices > 0"
        :on-current="row.stats.on_current"
        :devices="row.stats.devices"
      />
      <span v-else class="text-muted-foreground text-xs">no devices</span>
    </template>
    <template #cell-devices="{ row }">
      <span class="font-mono text-xs tabular">{{ formatCount(row.stats?.devices) }}</span>
    </template>
    <template #cell-active_24h="{ row }">
      <span class="font-mono text-xs tabular">{{ formatCount(row.stats?.active_24h) }}</span>
    </template>
    <template #cell-installs_24h="{ row }">
      <span class="text-success font-mono text-xs tabular">{{
        formatCount(row.stats?.installs_24h)
      }}</span>
    </template>
    <template #cell-failures_24h="{ row }">
      <span
        class="font-mono text-xs tabular"
        :class="row.stats?.failures_24h ? 'text-destructive' : 'text-muted-foreground'"
        >{{ formatCount(row.stats?.failures_24h) }}</span
      >
    </template>
    <template #cell-actions="{ row }">
      <div class="flex items-center justify-end gap-1">
        <GateButton
          size="xs"
          variant="outline"
          :gate="permissions.deliver(row.channel.environment)"
          @click="props.dialogs.deliver(row.channel)"
          >Deliver</GateButton
        >
        <ChannelActionsMenu
          :channel="row.channel"
          :dialogs="props.dialogs"
          @delete="emit('delete', $event)"
        />
      </div>
    </template>
  </DataTable>
</template>
