<script setup lang="ts">
import { Package, Smartphone } from "@lucide/vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  kind: "ota" | "native";
  version: string | null | undefined;
  code?: number | null;
  muted?: boolean;
  class?: string;
}>();
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 font-mono text-xs tabular',
        props.muted || !props.version ? 'text-muted-foreground' : 'text-foreground',
        props.class,
      )
    "
    :title="props.kind === 'ota' ? 'OTA bundle' : 'Native build'"
  >
    <Package v-if="props.kind === 'ota'" class="size-3 shrink-0 opacity-60" />
    <Smartphone v-else class="size-3 shrink-0 opacity-60" />
    <span v-if="props.version">{{ props.version }}</span>
    <span v-else>none</span>
    <span v-if="props.kind === 'native' && props.code != null" class="text-muted-foreground"
      >({{ props.code }})</span
    >
  </span>
</template>
