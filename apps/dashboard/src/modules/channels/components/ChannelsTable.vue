<script setup lang="ts">
import { CornerDownRight, Globe } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdoptionMeter from "@/shared/components/AdoptionMeter.vue";
import ChannelStatusBadges from "@/shared/components/ChannelStatusBadges.vue";
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
import ChannelActionsMenu from "./ChannelActionsMenu.vue";

const props = defineProps<{
  catalog: ReleaseCatalog;
  health: ReadonlyMap<string, ChannelStats>;
  dialogs: DeliveryDialogController;
}>();
const emit = defineEmits<{ delete: [channel: Channel] }>();

const permissions = useAppPermissions();

const rows = computed(() =>
  orderChannels(props.catalog.channels).map((row) => ({
    ...row,
    current: channelCurrent(row.channel, props.catalog),
    stats: props.health.get(row.channel.id) ?? null,
  })),
);
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader class="bg-surface">
        <TableRow>
          <TableHead class="w-[28%]">Channel</TableHead>
          <TableHead>OTA bundle</TableHead>
          <TableHead>Native</TableHead>
          <TableHead class="w-40">Adoption</TableHead>
          <TableHead class="text-right">Devices</TableHead>
          <TableHead class="text-right">Active 24h</TableHead>
          <TableHead class="text-right">Installs / fails 24h</TableHead>
          <TableHead class="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="row in rows"
          :key="row.channel.id"
          :class="row.channel.paused && 'bg-danger-soft/20'"
        >
          <TableCell>
            <div class="flex items-center gap-2" :class="row.depth === 1 && 'pl-5'">
              <CornerDownRight
                v-if="row.depth === 1"
                class="text-muted-foreground size-3.5 shrink-0"
              />
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
          </TableCell>
          <TableCell>
            <VersionTag kind="ota" :version="row.current.bundle?.version_name" />
          </TableCell>
          <TableCell>
            <VersionTag
              kind="native"
              :version="row.current.native?.version_name"
              :code="row.current.native?.version_code"
            />
          </TableCell>
          <TableCell>
            <AdoptionMeter
              v-if="row.stats && row.stats.devices > 0"
              :on-current="row.stats.on_current"
              :devices="row.stats.devices"
            />
            <span v-else class="text-muted-foreground text-xs">no devices</span>
          </TableCell>
          <TableCell class="text-right font-mono text-xs tabular">{{
            formatCount(row.stats?.devices)
          }}</TableCell>
          <TableCell class="text-right font-mono text-xs tabular">{{
            formatCount(row.stats?.active_24h)
          }}</TableCell>
          <TableCell class="text-right font-mono text-xs tabular">
            <span class="text-success">{{ formatCount(row.stats?.installs_24h) }}</span>
            <span class="text-muted-foreground"> / </span>
            <span :class="row.stats?.failures_24h ? 'text-destructive' : 'text-muted-foreground'">{{
              formatCount(row.stats?.failures_24h)
            }}</span>
          </TableCell>
          <TableCell>
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
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
