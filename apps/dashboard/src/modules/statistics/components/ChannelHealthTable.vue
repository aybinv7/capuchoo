<script setup lang="ts">
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
import { formatCount, formatPercent, ratio } from "@/shared/lib/format";
import { RouteName } from "@/shared/router/route-names";
import type { ChannelStats } from "@/shared/types/stats";

const props = defineProps<{ channels: readonly ChannelStats[] }>();

const rows = computed(() =>
  [...props.channels]
    .sort((a, b) => b.devices - a.devices || (a.name ?? "").localeCompare(b.name ?? ""))
    .map((row) => ({ ...row, success: ratio(row.installs_7d, row.installs_7d + row.failures_7d) })),
);
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <Table>
      <TableHeader class="bg-surface">
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead class="text-right">Devices</TableHead>
          <TableHead class="text-right">Active 24h</TableHead>
          <TableHead class="w-48">On current bundle</TableHead>
          <TableHead class="text-right">Installs 7d</TableHead>
          <TableHead class="text-right">Failures 7d</TableHead>
          <TableHead class="text-right">Success 7d</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="row in rows" :key="row.channel_id">
          <TableCell>
            <RouterLink
              :to="{ name: RouteName.channel, params: { channelId: row.channel_id } }"
              class="font-mono text-sm hover:underline"
              >{{ row.name ?? row.channel_id.slice(0, 8) }}</RouterLink
            >
          </TableCell>
          <TableCell class="text-right font-mono text-xs tabular">{{
            formatCount(row.devices)
          }}</TableCell>
          <TableCell class="text-right font-mono text-xs tabular">{{
            formatCount(row.active_24h)
          }}</TableCell>
          <TableCell>
            <AdoptionMeter :on-current="row.on_current" :devices="row.devices" />
          </TableCell>
          <TableCell class="text-right font-mono text-xs tabular">{{
            formatCount(row.installs_7d)
          }}</TableCell>
          <TableCell
            class="text-right font-mono text-xs tabular"
            :class="row.failures_7d ? 'text-destructive' : 'text-muted-foreground'"
            >{{ formatCount(row.failures_7d) }}</TableCell
          >
          <TableCell class="text-right font-mono text-xs tabular">{{
            formatPercent(row.success)
          }}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
