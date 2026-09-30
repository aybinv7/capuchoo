<script setup lang="ts">
import type { LaneNodeData } from "../../types/canvas.types";

defineOptions({ inheritAttrs: false });

defineProps<{ data: LaneNodeData }>();
</script>

<template>
  <div class="pointer-events-none flex items-baseline gap-2 select-none">
    <span class="font-mono text-xs font-semibold tracking-widest uppercase">{{ data.label }}</span>
    <span class="text-muted-foreground text-[11px]">{{ data.hint }}</span>
  </div>
</template>
