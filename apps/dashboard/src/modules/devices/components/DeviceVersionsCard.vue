<script setup lang="ts">
import { Layers } from "@lucide/vue";
import { computed } from "vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import VersionTag from "@/shared/components/VersionTag.vue";
import type { Channel, ReleaseCatalog } from "@/shared/types/release";
import { nativeAlignment, otaAlignment } from "../lib/channel-alignment";
import type { DeviceDetail } from "../types/devices.types";
import AlignmentNote from "./AlignmentNote.vue";

const props = defineProps<{
  device: DeviceDetail;
  channel: Channel | null;
  catalog: ReleaseCatalog;
}>();

const BUILTIN = "builtin";

const onBuiltin = computed(() => props.device.version_name === BUILTIN);
const ota = computed(() =>
  otaAlignment(onBuiltin.value ? null : props.device.version_name, props.channel, props.catalog),
);
const native = computed(() =>
  nativeAlignment(props.device.version_code, props.channel, props.catalog),
);
const environment = computed(
  () => props.channel?.environment ?? props.device.channel?.environment ?? null,
);
const build = computed(() => {
  if (props.device.is_prod === false) return "Debug";
  if (props.device.is_prod === true) return "Release";
  return "Unknown";
});
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border">
    <header class="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <span class="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase">
        <Layers class="size-3.5" />
        Versions
      </span>
      <EnvBadge :environment="environment" size="sm" />
    </header>
    <dl class="divide-y text-sm">
      <div class="flex items-start justify-between gap-3 px-4 py-2.5">
        <dt class="text-muted-foreground text-xs">OTA bundle</dt>
        <dd class="flex flex-col items-end gap-0.5 text-right">
          <span v-if="onBuiltin" class="text-muted-foreground text-xs">built-in, none applied</span>
          <VersionTag v-else kind="ota" :version="props.device.version_name" />
          <AlignmentNote :alignment="ota" />
        </dd>
      </div>
      <div class="flex items-start justify-between gap-3 px-4 py-2.5">
        <dt class="text-muted-foreground text-xs">Native build</dt>
        <dd class="flex flex-col items-end gap-0.5 text-right">
          <VersionTag
            kind="native"
            :version="props.device.version_builtin"
            :code="props.device.version_code"
          />
          <AlignmentNote :alignment="native" />
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-2.5">
        <dt class="text-muted-foreground text-xs">Updater plugin</dt>
        <dd class="font-mono text-xs">{{ props.device.plugin_version ?? "—" }}</dd>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-2.5">
        <dt class="text-muted-foreground text-xs">Build</dt>
        <dd :class="['text-xs', props.device.is_prod === false && 'text-warning']">
          {{ build }}
        </dd>
      </div>
    </dl>
  </section>
</template>
