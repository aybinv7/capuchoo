<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { RouteName } from "@/shared/router/route-names";
import type { DeviceRef } from "../types/devices.types";
import AttributeChips from "./AttributeChips.vue";

const props = defineProps<{ device: DeviceRef | null }>();

const title = computed(() => {
  const device = props.device;
  if (!device) return "Removed device";
  return device.custom_id ?? device.device_name ?? device.model ?? "Unknown device";
});
const secondary = computed(() => {
  const device = props.device;
  if (!device?.custom_id) return null;
  return device.device_name ?? device.model;
});
</script>

<template>
  <span class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
    <RouterLink
      v-if="props.device"
      :to="{ name: RouteName.device, params: { deviceId: props.device.id } }"
      class="max-w-56 truncate font-mono underline-offset-2 hover:underline"
      >{{ title }}</RouterLink
    >
    <span v-else class="text-muted-foreground italic">{{ title }}</span>
    <span v-if="secondary" class="text-muted-foreground max-w-40 truncate">{{ secondary }}</span>
    <AttributeChips v-if="props.device?.attributes" :attributes="props.device.attributes" />
  </span>
</template>
