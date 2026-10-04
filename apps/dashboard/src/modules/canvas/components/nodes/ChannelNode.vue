<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { Ellipsis, Globe, Rocket } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AdoptionMeter from "@/shared/components/AdoptionMeter.vue";
import ChannelStatusBadges from "@/shared/components/ChannelStatusBadges.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { formatCount } from "@/shared/lib/format";
import { useCanvasContext } from "../../composables/useCanvasContext";
import { useDropTarget } from "../../composables/useDropTarget";
import type { ChannelNodeData } from "../../types/canvas.types";
import ArtefactChip from "../ArtefactChip.vue";
import ChannelContextMenu from "../ChannelContextMenu.vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{ data: ChannelNodeData }>();

const channel = computed(() => props.data.channel);
const stats = computed(() => props.data.stats);
const { dialogs, catalog } = useCanvasContext();
const permissions = useAppPermissions();
const gate = computed(() => permissions.deliver(channel.value.environment));
const { state, hovering, handlers } = useDropTarget(channel);

const baseName = computed(() =>
  channel.value.base_channel_id
    ? (catalog.value.channels.find((entry) => entry.id === channel.value.base_channel_id)?.name ??
      "missing base")
    : null,
);

/** The context menu opens on right-click; the button raises the same event for pointer-only users. */
function openMenu(event: MouseEvent) {
  event.currentTarget?.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      clientX: event.clientX,
      clientY: event.clientY,
    }),
  );
}

const ENV_RAIL = { dev: "bg-env-dev", staging: "bg-env-staging", prod: "bg-env-prod" } as const;
</script>

<template>
  <ChannelContextMenu :channel="channel">
    <div
      :class="
        cn(
          'bg-card relative w-[272px] overflow-hidden rounded-lg border shadow-sm transition-[box-shadow,border-color]',
          channel.paused && 'border-destructive/40',
          state.kind === 'accept' && 'border-success ring-success/30 ring-2',
          state.kind === 'accept' && hovering && 'ring-success/60 ring-4',
          state.kind === 'refuse' && 'opacity-70',
        )
      "
      v-on="handlers"
    >
      <Handle
        type="target"
        :position="Position.Left"
        :connectable="false"
        class="!size-2 !border-0 !opacity-0"
      />
      <span
        :class="cn('absolute inset-y-0 left-0 w-1', ENV_RAIL[channel.environment])"
        aria-hidden="true"
      />
      <header class="flex items-start justify-between gap-2 py-2.5 pr-2 pl-4">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="truncate font-mono text-sm font-semibold">{{ channel.name }}</span>
            <Globe
              v-if="channel.public"
              class="text-muted-foreground size-3 shrink-0"
              aria-label="Public"
            />
          </div>
          <div class="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]">
            <EnvBadge :environment="channel.environment" size="sm" />
            <span v-if="baseName">follows {{ baseName }}</span>
            <span v-else>release</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          class="nodrag"
          aria-label="Channel actions (right-click)"
          @click="openMenu"
        >
          <Ellipsis />
        </Button>
      </header>

      <div class="flex flex-wrap gap-1 px-4 pb-1">
        <ChannelStatusBadges :channel="channel" />
      </div>

      <div class="space-y-1.5 px-4 py-2">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-muted-foreground w-12 shrink-0">OTA</span>
          <ArtefactChip
            v-if="props.data.bundle"
            :artefact="props.data.bundle"
            :source-channel-id="channel.id"
          />
          <span v-else class="text-muted-foreground font-mono">none</span>
        </div>
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="text-muted-foreground w-12 shrink-0">Native</span>
          <ArtefactChip
            v-if="props.data.native"
            :artefact="props.data.native"
            :source-channel-id="channel.id"
          />
          <span v-else class="text-muted-foreground font-mono">none</span>
        </div>
      </div>

      <div class="bg-surface grid grid-cols-3 gap-2 border-t px-4 py-2 text-[11px]">
        <div>
          <div class="text-muted-foreground">Devices</div>
          <div class="font-mono text-sm font-semibold tabular">
            {{ formatCount(stats?.devices ?? 0) }}
          </div>
        </div>
        <div>
          <div class="text-muted-foreground">Active 24h</div>
          <div class="font-mono text-sm font-semibold tabular">
            {{ formatCount(stats?.active_24h ?? 0) }}
          </div>
        </div>
        <div>
          <div class="text-muted-foreground">24h in / fail</div>
          <div class="font-mono text-sm font-semibold tabular">
            <span class="text-success">{{ formatCount(stats?.installs_24h ?? 0) }}</span>
            <span class="text-muted-foreground">/</span>
            <span :class="stats?.failures_24h ? 'text-destructive' : 'text-muted-foreground'">{{
              formatCount(stats?.failures_24h ?? 0)
            }}</span>
          </div>
        </div>
        <div class="col-span-3">
          <AdoptionMeter :on-current="stats?.on_current ?? 0" :devices="stats?.devices ?? 0" />
        </div>
      </div>

      <footer class="flex items-center justify-end border-t px-2 py-1.5">
        <Button
          size="xs"
          variant="ghost"
          class="nodrag"
          :disabled="!gate.ok"
          :title="gate.ok ? undefined : gate.reason"
          @click="dialogs.deliver(channel)"
        >
          <Rocket />
          Deliver
        </Button>
      </footer>

      <div
        v-if="state.kind !== 'idle'"
        :class="
          cn(
            'pointer-events-none absolute inset-x-0 bottom-0 px-3 py-1.5 text-[11px] font-medium text-pretty',
            state.kind === 'accept' ? 'bg-success text-background' : 'bg-destructive/90 text-white',
          )
        "
        role="status"
      >
        {{ state.message }}
      </div>

      <Handle
        type="source"
        :position="Position.Right"
        :connectable="false"
        class="!size-2 !border-0 !opacity-0"
      />
    </div>
  </ChannelContextMenu>
</template>
