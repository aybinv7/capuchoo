<script setup lang="ts">
import { Radar } from "@lucide/vue";
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import StatusDot from "@/shared/components/StatusDot.vue";
import type { RecorderCheckIn } from "../../types/recordings.types";
import DeviceHealthCard from "./DeviceHealthCard.vue";

const props = defineProps<{
  devices: readonly RecorderCheckIn[];
  loading: boolean;
  error: unknown;
  retry: () => void;
}>();

const online = computed(() => props.devices.filter((device) => device.online).length);
</script>

<template>
  <section class="flex max-h-full min-h-0 flex-col rounded-xl border" aria-labelledby="check-title">
    <header class="flex items-center gap-2 border-b px-4 py-3">
      <Radar class="text-muted-foreground size-4" aria-hidden="true" />
      <h2 id="check-title" class="flex-1 text-sm font-semibold">Integration check</h2>
      <span v-if="props.devices.length" class="text-muted-foreground tabular text-xs">
        {{ online }} online
      </span>
    </header>

    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
      <ErrorNotice
        v-if="props.error && !props.devices.length"
        :error="props.error"
        :retry="props.retry"
      />
      <template v-else-if="props.loading">
        <Skeleton class="h-32" />
        <Skeleton class="h-32" />
      </template>
      <div v-else-if="!props.devices.length" class="space-y-3 px-1 py-6 text-center">
        <div class="flex justify-center">
          <StatusDot tone="info" pulse class="size-3" />
        </div>
        <p class="text-sm font-medium">Waiting for a device</p>
        <p class="text-muted-foreground mx-auto max-w-xs text-xs text-pretty">
          Open the app on a phone or emulator. Its recorder reports here within seconds of asking
          for its rules, whether or not anything is being recorded yet.
        </p>
      </div>
      <DeviceHealthCard v-for="device in props.devices" :key="device.device_id" :device="device" />
    </div>
  </section>
</template>
