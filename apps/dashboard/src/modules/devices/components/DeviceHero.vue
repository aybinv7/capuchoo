<script setup lang="ts">
import { ArrowRightLeft, Bug, MonitorSmartphone } from "@lucide/vue";
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import GateButton from "@/shared/components/GateButton.vue";
import PlatformIcon from "@/shared/components/PlatformIcon.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { platformTile } from "../lib/device-hero";
import type { DeviceDetail } from "../types/devices.types";
import DeviceAttributeBar from "./DeviceAttributeBar.vue";
import DeviceHeroMenu from "./DeviceHeroMenu.vue";
import DeviceMetaLine from "./DeviceMetaLine.vue";
import DevicePresence from "./DevicePresence.vue";

const props = defineProps<{ device: DeviceDetail; title: string }>();
const emit = defineEmits<{ assign: []; remove: [] }>();

const permissions = useAppPermissions();
const assignGate = computed(() => permissions.assignDevice(null));
</script>

<template>
  <header class="space-y-3 border-b pb-5">
    <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div
        :class="
          cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            platformTile(props.device.platform),
          )
        "
      >
        <PlatformIcon :platform="props.device.platform" class="size-6" />
      </div>
      <div class="min-w-0 flex-1 basis-64 space-y-1">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1 class="min-w-0 truncate text-xl font-semibold tracking-tight" :title="props.title">
            {{ props.title }}
          </h1>
          <DevicePresence :last-seen-at="props.device.last_seen_at" />
          <Badge
            v-if="props.device.is_prod === false"
            variant="outline"
            class="border-warning/30 bg-warning-soft text-warning"
          >
            <Bug />
            Debug
          </Badge>
          <Badge v-if="props.device.is_emulator" variant="outline" class="text-muted-foreground">
            <MonitorSmartphone />
            Emulator
          </Badge>
        </div>
        <DeviceMetaLine :device="props.device" :title="props.title" />
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <GateButton variant="outline" size="sm" :gate="assignGate" @click="emit('assign')">
          <ArrowRightLeft />
          Assign channel
        </GateButton>
        <DeviceHeroMenu :device="props.device" @remove="emit('remove')" />
      </div>
    </div>
    <DeviceAttributeBar
      class="sm:pl-15"
      :attributes="props.device.attributes"
      :updated-at="props.device.attributes_updated_at"
    />
  </header>
</template>
