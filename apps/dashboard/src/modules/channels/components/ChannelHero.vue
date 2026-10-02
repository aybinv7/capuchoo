<script setup lang="ts">
import type { Environment } from "@capuchoo/core";
import { CirclePause, CirclePlay, History, RadioTower, Rocket, Settings2 } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import GateButton from "@/shared/components/GateButton.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import type { DeliveryDialogController } from "@/shared/delivery/composables/useDeliveryDialogs";
import type { Channel } from "@/shared/types/release";
import ChannelActionsMenu from "./ChannelActionsMenu.vue";
import ChannelMetaLine from "./ChannelMetaLine.vue";
import ChannelStatePills from "./ChannelStatePills.vue";

const props = defineProps<{
  channel: Channel;
  base: Channel | null;
  dialogs: DeliveryDialogController;
  version: string | null;
  since: { at: string | null; by: string | null } | null;
  devices: number | null;
  devicesPending: boolean;
  pauseReason: string | null;
}>();
const emit = defineEmits<{ settings: []; delete: [] }>();

const TILE: Record<Environment, string> = {
  dev: "bg-env-dev/10 text-env-dev ring-env-dev/25",
  staging: "bg-env-staging/10 text-env-staging ring-env-staging/25",
  prod: "bg-env-prod/10 text-env-prod ring-env-prod/25",
};

const permissions = useAppPermissions();
const deliverGate = computed(() => permissions.deliver(props.channel.environment));
</script>

<template>
  <header class="border-b pb-5">
    <div class="flex flex-wrap items-start gap-x-4 gap-y-3">
      <div
        :class="
          cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            TILE[props.channel.environment],
            props.channel.paused && 'opacity-60',
          )
        "
        aria-hidden="true"
      >
        <RadioTower class="size-6" />
      </div>
      <div class="min-w-0 flex-1 basis-64 space-y-1.5">
        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <h1
            class="min-w-0 truncate font-mono text-xl font-semibold tracking-tight"
            :title="props.channel.name"
          >
            {{ props.channel.name }}
          </h1>
          <EnvBadge :environment="props.channel.environment" />
          <ChannelStatePills
            :channel="props.channel"
            :base="props.base"
            :pause-reason="props.pauseReason"
          />
        </div>
        <ChannelMetaLine
          :channel="props.channel"
          :version="props.version"
          :since="props.since"
          :devices="props.devices"
          :devices-pending="props.devicesPending"
        />
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <GateButton size="sm" :gate="deliverGate" @click="props.dialogs.deliver(props.channel)">
          <Rocket />
          Deliver
        </GateButton>
        <GateButton
          variant="outline"
          size="sm"
          :gate="deliverGate"
          @click="props.dialogs.rollback(props.channel)"
        >
          <History />
          Roll back
        </GateButton>
        <GateButton
          variant="outline"
          size="sm"
          :gate="deliverGate"
          @click="props.dialogs.togglePause(props.channel)"
        >
          <CirclePlay v-if="props.channel.paused" />
          <CirclePause v-else />
          {{ props.channel.paused ? "Resume" : "Pause" }}
        </GateButton>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Channel settings"
          title="Settings"
          @click="emit('settings')"
        >
          <Settings2 />
        </Button>
        <ChannelActionsMenu
          :channel="props.channel"
          :dialogs="props.dialogs"
          trigger="outline"
          with-settings
          @settings="emit('settings')"
          @delete="emit('delete')"
        />
      </div>
    </div>
  </header>
</template>
