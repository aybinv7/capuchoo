<script setup lang="ts">
import { ArrowRight, Smartphone } from "@lucide/vue";
import EnvBadge from "../../components/EnvBadge.vue";
import VersionTag from "../../components/VersionTag.vue";
import { formatCount } from "../../lib/format";
import type { Artefact, Channel } from "../../types/release";

const props = defineProps<{
  channel: Channel;
  kind: "ota" | "native";
  from: Artefact | null;
  to: Artefact | null;
  devices: number | null;
  direction?: "forward" | "same" | "downgrade" | null;
}>();

const code = (artefact: Artefact | null) =>
  artefact?.kind === "native" ? artefact.version_code : null;
</script>

<template>
  <dl class="bg-surface grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5 rounded-lg border p-4 text-sm">
    <dt class="text-muted-foreground">Channel</dt>
    <dd class="flex items-center gap-2 font-medium">
      <span class="font-mono">{{ props.channel.name }}</span>
      <EnvBadge :environment="props.channel.environment" />
      <span v-if="props.channel.kind === 'client'" class="text-muted-foreground text-xs"
        >client channel</span
      >
    </dd>

    <dt class="text-muted-foreground">
      {{ props.kind === "ota" ? "OTA bundle" : "Native build" }}
    </dt>
    <dd class="flex flex-wrap items-center gap-2">
      <VersionTag
        :kind="props.kind"
        :version="props.from?.version_name"
        :code="code(props.from)"
        muted
      />
      <ArrowRight class="text-muted-foreground size-3.5" />
      <VersionTag
        :kind="props.kind"
        :version="props.to?.version_name"
        :code="code(props.to)"
        class="font-semibold"
      />
      <span
        v-if="props.direction === 'downgrade'"
        class="bg-warning-soft text-warning rounded px-1.5 py-px text-[11px] font-medium"
        >downgrade</span
      >
    </dd>

    <dt class="text-muted-foreground">Affects</dt>
    <dd class="flex items-center gap-1.5">
      <Smartphone class="text-muted-foreground size-3.5" />
      <template v-if="props.devices !== null">
        <span class="font-medium tabular">{{ formatCount(props.devices, true) }}</span>
        {{ props.devices === 1 ? "device" : "devices" }} on this channel
      </template>
      <span v-else class="text-muted-foreground">device count unavailable</span>
    </dd>
  </dl>
</template>
