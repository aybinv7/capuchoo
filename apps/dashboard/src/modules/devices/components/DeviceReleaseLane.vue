<script setup lang="ts">
import type { Environment } from "@capuchoo/core";
import { ChevronRight, Package, Pin, Radio, Smartphone } from "@lucide/vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { RouteName } from "@/shared/router/route-names";
import type { Channel, ReleaseCatalog } from "@/shared/types/release";
import { nativeAlignment, otaAlignment } from "../lib/channel-alignment";
import { alignmentStatus, channelHint, otaLabel, type LaneStatus } from "../lib/release-lane";
import type { DeviceDetail } from "../types/devices.types";
import ReleaseLaneNode from "./ReleaseLaneNode.vue";

const props = defineProps<{
  device: DeviceDetail;
  channel: Channel | null;
  catalog: ReleaseCatalog;
  /** The catalog has not answered yet, so alignment cannot be told. */
  pending: boolean;
}>();

const ENV_DOT: Record<Environment, string> = {
  dev: "bg-env-dev",
  staging: "bg-env-staging",
  prod: "bg-env-prod",
};

const channelId = computed(() => props.device.channel?.id ?? props.device.channel_id);
const channelName = computed(
  () => props.channel?.name ?? props.device.channel?.name ?? props.device.channel_name ?? null,
);
const environment = computed(
  () => props.channel?.environment ?? props.device.channel?.environment ?? null,
);
const assigned = computed(() =>
  Boolean(props.device.assigned_channel || props.device.assigned_channel_id),
);
const channelStatus = computed<LaneStatus | null>(() => {
  const hint = channelHint(props.device, channelName.value);
  if (hint) return { tone: assigned.value ? "muted" : "warning", text: hint };
  return environment.value && environment.value !== channelName.value
    ? { tone: "muted", text: environment.value }
    : null;
});

const ota = computed(() => otaLabel(props.device.version_name));
const otaStatus = computed(() =>
  alignmentStatus(otaAlignment(props.device.version_name, props.channel, props.catalog)),
);
const nativeStatus = computed(() =>
  alignmentStatus(nativeAlignment(props.device.version_code, props.channel, props.catalog)),
);
const statusPending = computed(() => props.pending && Boolean(channelId.value));
</script>

<template>
  <section
    aria-label="Release lane"
    class="bg-card flex flex-col rounded-lg border p-1 lg:flex-row lg:items-center"
  >
    <ol class="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-center">
      <li class="min-w-0 lg:flex-1">
        <ReleaseLaneNode
          label="Channel"
          :to="channelId ? { name: RouteName.channel, params: { channelId } } : null"
          :status="channelStatus"
        >
          <template #icon><Radio /></template>
          <span
            :class="
              cn(
                'size-2 shrink-0 rounded-full',
                environment ? ENV_DOT[environment] : 'bg-muted-foreground/40',
              )
            "
            aria-hidden="true"
          />
          <span v-if="channelName" class="truncate">{{ channelName }}</span>
          <span v-else class="text-muted-foreground truncate">unresolved</span>
          <Pin
            v-if="assigned"
            class="text-primary size-3 shrink-0"
            aria-label="Assigned from the dashboard"
          />
        </ReleaseLaneNode>
      </li>
      <li
        class="text-muted-foreground/60 flex justify-center py-0.5 lg:px-0.5 lg:py-0"
        aria-hidden="true"
      >
        <ChevronRight class="size-4 rotate-90 lg:rotate-0" />
      </li>
      <li class="min-w-0 lg:flex-1">
        <ReleaseLaneNode
          label="Native"
          :to="{ name: RouteName.releases, query: { kind: 'native' } }"
          :status="nativeStatus"
          :pending="statusPending"
        >
          <template #icon><Smartphone /></template>
          <span v-if="props.device.version_builtin" class="truncate">{{
            props.device.version_builtin
          }}</span>
          <span v-else class="text-muted-foreground">unknown</span>
          <span v-if="props.device.version_code != null" class="text-muted-foreground"
            >({{ props.device.version_code }})</span
          >
        </ReleaseLaneNode>
      </li>
      <li
        class="text-muted-foreground/60 flex justify-center py-0.5 lg:px-0.5 lg:py-0"
        aria-hidden="true"
      >
        <ChevronRight class="size-4 rotate-90 lg:rotate-0" />
      </li>
      <li class="min-w-0 lg:flex-1">
        <ReleaseLaneNode
          label="OTA bundle"
          :to="{ name: RouteName.releases, query: ota && ota !== 'built-in' ? { q: ota } : {} }"
          :status="otaStatus"
          :pending="statusPending"
        >
          <template #icon><Package /></template>
          <span v-if="ota" :class="cn('truncate', ota === 'built-in' && 'text-muted-foreground')">{{
            ota
          }}</span>
          <span v-else class="text-muted-foreground">unknown</span>
        </ReleaseLaneNode>
      </li>
    </ol>
    <p
      class="text-muted-foreground border-t px-3 py-2 font-mono text-[11px] whitespace-nowrap lg:border-t-0 lg:border-l lg:py-3"
      :title="
        props.device.plugin_version ? 'Updater plugin version' : 'Updater plugin version unknown'
      "
    >
      plugin {{ props.device.plugin_version ?? "—" }}
    </p>
  </section>
</template>
