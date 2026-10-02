<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { formatCount } from "@/shared/lib/format";
import type { Channel } from "@/shared/types/release";

const props = defineProps<{
  channel: Channel;
  /** The OTA version served, null when none is. */
  version: string | null;
  since: { at: string | null; by: string | null } | null;
  /** Devices resolved to the channel; null while unknown. */
  devices: number | null;
  devicesPending: boolean;
}>();

const platforms = computed(() =>
  [
    props.channel.android_enabled ? { key: "android", label: "Android" } : null,
    props.channel.ios_enabled ? { key: "ios", label: "iOS" } : null,
  ].filter((entry) => entry !== null),
);
</script>

<template>
  <ul
    class="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs [&>li+li]:before:mr-2 [&>li+li]:before:opacity-60 [&>li+li]:before:content-['·']"
  >
    <li v-if="props.version" class="flex min-w-0 items-center gap-1">
      serving
      <span class="text-foreground font-mono">{{ props.version }}</span>
      <template v-if="props.since?.at">since <RelativeTime :value="props.since.at" /></template>
    </li>
    <li v-else>no OTA bundle served</li>
    <li v-if="props.version && props.since?.by" class="min-w-0 truncate">
      delivered by <span class="text-foreground">{{ props.since.by }}</span>
    </li>
    <li class="flex items-center">
      <Skeleton v-if="props.devicesPending" class="h-3 w-16" />
      <template v-else-if="props.devices !== null"
        >{{ formatCount(props.devices, true) }}
        {{ props.devices === 1 ? "device" : "devices" }}</template
      >
      <template v-else>devices unknown</template>
    </li>
    <li v-if="platforms.length" class="flex items-center gap-1.5">
      <span v-for="platform in platforms" :key="platform.key" class="flex items-center gap-1">
        <PlatformIcon :platform="platform.key" class="size-3.5" />
        {{ platform.label }}
      </span>
    </li>
    <li v-else class="text-warning">no platform enabled</li>
  </ul>
</template>
