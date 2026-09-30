<script setup lang="ts">
import { CirclePause, History } from "@lucide/vue";
import type { Channel } from "../types/release";

defineProps<{ channel: Pick<Channel, "paused" | "allow_downgrade"> }>();
</script>

<template>
  <span
    v-if="channel.paused"
    class="bg-danger-soft text-destructive inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase"
    title="Paused: the channel serves nothing until resumed"
  >
    <CirclePause class="size-3" />
    paused
  </span>
  <span
    v-if="channel.allow_downgrade"
    class="bg-warning-soft text-warning inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase"
    title="Rolled back: devices accept the lower bundle until the next forward delivery"
  >
    <History class="size-3" />
    rolled back
  </span>
</template>
