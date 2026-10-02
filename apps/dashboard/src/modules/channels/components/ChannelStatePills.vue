<script setup lang="ts">
import { CircleCheck, CirclePause, GitFork, History } from "@lucide/vue";
import { RouterLink } from "vue-router";
import StatusDot from "@/shared/components/StatusDot.vue";
import { RouteName } from "@/shared/router/route-names";
import type { Channel } from "@/shared/types/release";

const props = defineProps<{
  channel: Channel;
  base: Channel | null;
  pauseReason: string | null;
}>();
</script>

<template>
  <span
    v-if="props.channel.paused"
    class="border-destructive/30 bg-danger-soft text-destructive inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
    role="status"
    :title="props.pauseReason ?? 'Paused: the channel serves nothing until resumed'"
  >
    <CirclePause class="size-3 shrink-0" />
    <span class="font-medium">Paused</span>
    <span v-if="props.pauseReason" class="truncate opacity-80">· {{ props.pauseReason }}</span>
  </span>
  <span
    v-else
    class="text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
    role="status"
  >
    <StatusDot tone="success" pulse />
    <span class="text-foreground">Live</span>
  </span>
  <span
    v-if="props.channel.allow_downgrade"
    class="border-warning/30 bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
    title="Rolled back: devices accept the lower bundle until the next forward delivery"
  >
    <History class="size-3" />
    Rolled back
  </span>
  <component
    :is="props.base ? RouterLink : 'span'"
    v-if="props.channel.kind === 'client'"
    :to="props.base ? { name: RouteName.channel, params: { channelId: props.base.id } } : undefined"
    :class="[
      'text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
      props.base && 'hover:bg-accent hover:text-foreground',
    ]"
    title="A client channel serves what its base release channel has delivered"
  >
    <GitFork class="size-3" />
    follows
    <span class="text-foreground font-mono">{{ props.base?.name ?? "a missing channel" }}</span>
  </component>
  <span
    v-if="props.channel.public"
    class="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
    title="Devices that name no channel can be resolved to this one"
  >
    <CircleCheck class="size-3" />
    Public
  </span>
</template>
