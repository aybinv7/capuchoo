<script setup lang="ts">
import { computed } from "vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { platformLabel } from "../lib/device-hero";
import type { Device } from "../types/devices.types";
import CopyableId from "./CopyableId.vue";

const props = defineProps<{ device: Device; title: string }>();

const hardware = computed(() => {
  const text = [props.device.manufacturer, props.device.model].filter(Boolean).join(" ");
  return text && text !== props.title ? text : null;
});
const system = computed(() =>
  [platformLabel(props.device.platform), props.device.version_os].filter(Boolean).join(" "),
);
</script>

<template>
  <ul
    class="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs [&>li+li]:before:mr-2 [&>li+li]:before:opacity-60 [&>li+li]:before:content-['·']"
  >
    <li v-if="hardware" class="truncate">{{ hardware }}</li>
    <li v-if="system">{{ system }}</li>
    <li>first seen <RelativeTime :value="props.device.created_at" /></li>
    <li class="flex min-w-0">
      <CopyableId :value="props.device.device_id" label="device id" />
    </li>
    <li v-if="props.device.custom_id" class="flex min-w-0">
      <CopyableId :value="props.device.custom_id" label="custom id" prefix="custom" />
    </li>
  </ul>
</template>
