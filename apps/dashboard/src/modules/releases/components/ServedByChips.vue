<script setup lang="ts">
import { RouterLink } from "vue-router";
import { RouteName } from "@/shared/router/route-names";
import type { Channel } from "@/shared/types/release";

defineProps<{ channels: readonly Channel[] }>();
</script>

<template>
  <div class="flex min-w-0 flex-wrap gap-1">
    <span v-if="channels.length === 0" class="text-muted-foreground text-xs">not served</span>
    <RouterLink
      v-for="channel in channels"
      :key="channel.id"
      :to="{ name: RouteName.channel, params: { channelId: channel.id } }"
      class="bg-success-soft text-success hover:ring-success/40 rounded px-1.5 py-px font-mono text-[11px] hover:ring-1"
      >{{ channel.name }}</RouterLink
    >
  </div>
</template>
