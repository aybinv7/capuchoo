<script setup lang="ts">
import { CirclePause, CirclePlay, Ellipsis, History, Rocket, Settings2, Trash2 } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import type { DeliveryDialogController } from "@/shared/delivery/composables/useDeliveryDialogs";
import type { Channel } from "@/shared/types/release";

const props = defineProps<{
  channel: Channel;
  dialogs: DeliveryDialogController;
  /** Offer the settings sheet, on a page that hosts it. */
  withSettings?: boolean;
  trigger?: "ghost" | "outline";
}>();
const emit = defineEmits<{ delete: [channel: Channel]; settings: [] }>();

const permissions = useAppPermissions();
const deliverGate = computed(() => permissions.deliver(props.channel.environment));
const manageGate = computed(() => permissions.manageChannels.value);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        :variant="props.trigger ?? 'ghost'"
        size="icon-sm"
        :aria-label="`Actions for ${props.channel.name}`"
      >
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel
        v-if="!deliverGate.ok"
        class="text-muted-foreground text-xs font-normal text-pretty"
      >
        {{ deliverGate.reason }}
      </DropdownMenuLabel>
      <DropdownMenuItem :disabled="!deliverGate.ok" @select="props.dialogs.deliver(props.channel)">
        <Rocket class="size-4" />
        Deliver
      </DropdownMenuItem>
      <DropdownMenuItem :disabled="!deliverGate.ok" @select="props.dialogs.rollback(props.channel)">
        <History class="size-4" />
        Roll back
      </DropdownMenuItem>
      <DropdownMenuItem
        :disabled="!deliverGate.ok"
        @select="props.dialogs.togglePause(props.channel)"
      >
        <CirclePlay v-if="props.channel.paused" class="size-4" />
        <CirclePause v-else class="size-4" />
        {{ props.channel.paused ? "Resume" : "Pause" }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-if="props.withSettings" @select="emit('settings')">
        <Settings2 class="size-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="destructive"
        :disabled="!manageGate.ok"
        :title="manageGate.ok ? undefined : manageGate.reason"
        @select="emit('delete', props.channel)"
      >
        <Trash2 class="size-4" />
        Delete channel
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
