<script setup lang="ts">
import { Pin } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";
import CopyButton from "@/shared/components/CopyButton.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { RouteName } from "@/shared/router/route-names";
import type { DeviceDetail } from "../types/devices.types";

const props = defineProps<{ device: DeviceDetail }>();

const channelId = computed(() => props.device.channel?.id ?? props.device.channel_id);
const channelName = computed(() => props.device.channel?.name ?? props.device.channel_name ?? null);
const assigned = computed(
  () => props.device.assigned_channel?.name ?? (props.device.assigned_channel_id ? "yes" : null),
);
const reportedDiffers = computed(
  () =>
    Boolean(props.device.reported_channel) && props.device.reported_channel !== channelName.value,
);
</script>

<template>
  <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-xs md:grid-cols-3 xl:grid-cols-5">
    <div class="min-w-0">
      <dt class="text-muted-foreground">Channel</dt>
      <dd class="mt-0.5 flex min-w-0 items-center gap-1">
        <RouterLink
          v-if="channelId && channelName"
          :to="{ name: RouteName.channel, params: { channelId } }"
          class="truncate font-mono underline-offset-2 hover:underline"
          >{{ channelName }}</RouterLink
        >
        <span v-else class="text-muted-foreground font-mono">unresolved</span>
        <Pin
          v-if="assigned"
          class="text-primary size-3 shrink-0"
          aria-label="Assigned from the dashboard"
        />
      </dd>
      <dd v-if="assigned" class="text-muted-foreground truncate">assigned from the dashboard</dd>
      <dd v-else-if="reportedDiffers" class="text-muted-foreground truncate">
        build says <span class="font-mono">{{ props.device.reported_channel }}</span>
      </dd>
    </div>
    <div class="min-w-0">
      <dt class="text-muted-foreground">Custom id</dt>
      <dd class="mt-0.5 flex min-w-0 items-center gap-0.5">
        <span class="truncate font-mono">{{ props.device.custom_id ?? "—" }}</span>
        <CopyButton
          v-if="props.device.custom_id"
          :value="props.device.custom_id"
          label="custom id"
        />
      </dd>
    </div>
    <div class="min-w-0">
      <dt class="text-muted-foreground">Device id</dt>
      <dd class="mt-0.5 flex min-w-0 items-center gap-0.5">
        <span class="truncate font-mono" :title="props.device.device_id">{{
          props.device.device_id
        }}</span>
        <CopyButton :value="props.device.device_id" label="device id" />
      </dd>
    </div>
    <div>
      <dt class="text-muted-foreground">Last seen</dt>
      <dd class="mt-0.5"><RelativeTime :value="props.device.last_seen_at" /></dd>
    </div>
    <div>
      <dt class="text-muted-foreground">First seen</dt>
      <dd class="mt-0.5"><RelativeTime :value="props.device.created_at" /></dd>
    </div>
  </dl>
</template>
