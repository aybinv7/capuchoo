<script setup lang="ts">
import { Bug, MonitorSmartphone, Pin } from "@lucide/vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import VirtualRows from "@/shared/components/VirtualRows.vue";
import type { Device } from "../types/devices.types";
import DeviceRowActions from "./DeviceRowActions.vue";

defineProps<{ devices: readonly Device[] }>();
const emit = defineEmits<{ assign: [device: Device]; remove: [device: Device]; reachEnd: [] }>();

const COLUMNS =
  "minmax(12rem,1.6fr) 7rem minmax(7rem,1fr) minmax(7rem,1fr) minmax(9rem,1.2fr) 7rem 2.5rem";

const title = (device: Device) =>
  device.device_name ||
  [device.manufacturer, device.model].filter(Boolean).join(" ") ||
  "Unknown device";
</script>

<template>
  <VirtualRows
    :items="devices"
    :row-height="52"
    :columns="COLUMNS"
    :item-key="(device) => device.id"
    @reach-end="emit('reachEnd')"
  >
    <template #header>
      <span>Device</span>
      <span>Platform</span>
      <span>OTA bundle</span>
      <span>Native</span>
      <span>Channel</span>
      <span class="text-right">Last seen</span>
      <span />
    </template>
    <template #row="{ item }">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-sm">{{ title(item) }}</span>
          <MonitorSmartphone
            v-if="item.is_emulator"
            class="text-muted-foreground size-3.5 shrink-0"
            aria-label="Emulator"
          />
          <Bug
            v-if="item.is_prod === false"
            class="text-warning size-3.5 shrink-0"
            aria-label="Debug build"
          />
        </div>
        <div class="text-muted-foreground truncate font-mono text-[11px]" :title="item.device_id">
          {{ item.custom_id ?? item.device_id }}
        </div>
      </div>
      <div class="text-xs">
        <div class="font-mono uppercase">{{ item.platform }}</div>
        <div class="text-muted-foreground truncate">{{ item.version_os ?? "—" }}</div>
      </div>
      <VersionTag kind="ota" :version="item.version_name" />
      <VersionTag kind="native" :version="item.version_builtin" :code="item.version_code" />
      <div class="min-w-0 text-xs">
        <div class="flex items-center gap-1">
          <span class="truncate font-mono">{{
            item.channel_name ?? item.reported_channel ?? "unresolved"
          }}</span>
          <Pin
            v-if="item.assigned_channel_id"
            class="text-primary size-3 shrink-0"
            aria-label="Assigned from the dashboard"
          />
        </div>
        <div
          v-if="item.reported_channel && item.reported_channel !== item.channel_name"
          class="text-muted-foreground truncate"
        >
          build says {{ item.reported_channel }}
        </div>
      </div>
      <span class="text-muted-foreground text-right text-xs"
        ><RelativeTime :value="item.last_seen_at"
      /></span>
      <DeviceRowActions
        :device="item"
        @assign="emit('assign', item)"
        @remove="emit('remove', item)"
      />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </VirtualRows>
</template>
