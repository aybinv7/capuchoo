<script setup lang="ts">
import { CircleCheck, CircleDot } from "@lucide/vue";
import type { Alignment } from "../lib/channel-alignment";

const props = defineProps<{ alignment: Alignment }>();
</script>

<template>
  <span
    v-if="props.alignment.state === 'current'"
    class="text-success inline-flex items-center gap-1 text-[11px]"
  >
    <CircleCheck class="size-3" />
    channel's current
  </span>
  <span
    v-else-if="props.alignment.state === 'different'"
    class="text-warning inline-flex items-center gap-1 text-[11px]"
  >
    <CircleDot class="size-3" />
    channel serves <span class="font-mono">{{ props.alignment.served }}</span>
  </span>
</template>
