<script setup lang="ts">
import { Cpu } from "@lucide/vue";
import { computed } from "vue";
import { formatBytes } from "@/shared/lib/format";
import type { Device } from "../types/devices.types";

const props = defineProps<{ device: Device }>();

const rows = computed(() => [
  { label: "Manufacturer", value: props.device.manufacturer ?? "—" },
  { label: "Model", value: props.device.model ?? "—" },
  {
    label: "System",
    value: `${props.device.platform}${props.device.version_os ? ` ${props.device.version_os}` : ""}`,
  },
  { label: "Memory in use", value: formatBytes(props.device.mem_used_bytes) },
  {
    label: "Emulator",
    value: props.device.is_emulator === null ? "—" : props.device.is_emulator ? "Yes" : "No",
  },
]);
</script>

<template>
  <section class="bg-card min-w-0 rounded-lg border">
    <header
      class="text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium uppercase"
    >
      <Cpu class="size-3.5" />
      Hardware
    </header>
    <dl class="divide-y text-xs">
      <div
        v-for="row in rows"
        :key="row.label"
        class="flex items-center justify-between gap-3 px-4 py-2"
      >
        <dt class="text-muted-foreground">{{ row.label }}</dt>
        <dd class="truncate text-right font-mono">{{ row.value }}</dd>
      </div>
    </dl>
  </section>
</template>
