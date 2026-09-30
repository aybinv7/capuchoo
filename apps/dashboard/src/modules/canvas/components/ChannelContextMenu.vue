<script setup lang="ts">
import { CirclePause, CirclePlay, ExternalLink, History, Rocket } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { RouteName } from "@/shared/router/route-names";
import type { Channel } from "@/shared/types/release";
import { useCanvasContext } from "../composables/useCanvasContext";

const props = defineProps<{ channel: Channel }>();

const router = useRouter();
const { dialogs } = useCanvasContext();
const permissions = useAppPermissions();
const gate = computed(() => permissions.deliver(props.channel.environment));
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-60">
      <ContextMenuLabel class="font-mono text-xs">{{ props.channel.name }}</ContextMenuLabel>
      <ContextMenuLabel
        v-if="!gate.ok"
        class="text-muted-foreground text-xs font-normal text-pretty"
        >{{ gate.reason }}</ContextMenuLabel
      >
      <ContextMenuSeparator />
      <ContextMenuItem :disabled="!gate.ok" @select="dialogs.deliver(props.channel)">
        <Rocket class="size-4" />
        Deliver…
      </ContextMenuItem>
      <ContextMenuItem :disabled="!gate.ok" @select="dialogs.rollback(props.channel)">
        <History class="size-4" />
        Roll back…
      </ContextMenuItem>
      <ContextMenuItem :disabled="!gate.ok" @select="dialogs.togglePause(props.channel)">
        <CirclePlay v-if="props.channel.paused" class="size-4" />
        <CirclePause v-else class="size-4" />
        {{ props.channel.paused ? "Resume…" : "Pause…" }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        @select="router.push({ name: RouteName.channel, params: { channelId: props.channel.id } })"
      >
        <ExternalLink class="size-4" />
        Open channel
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
