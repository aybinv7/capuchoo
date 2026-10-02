<script setup lang="ts">
import { Rocket, ShieldAlert, ShieldCheck } from "@lucide/vue";
import type { RouteLocationRaw } from "vue-router";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import GateButton from "@/shared/components/GateButton.vue";
import ReleaseLaneNode from "@/shared/components/release-lane/ReleaseLaneNode.vue";
import type { LaneStatus } from "@/shared/components/release-lane/types";
import type { Gate } from "@/shared/lib/gate";
import type { Artefact } from "@/shared/types/release";
import ArtefactDetails from "./ArtefactDetails.vue";

const props = defineProps<{
  label: string;
  artefact: Artefact | null;
  status: LaneStatus | null;
  to: RouteLocationRaw;
  /** The catalog has not answered, so the artefact is not known yet. */
  pending: boolean;
  deliverGate: Gate;
}>();
const emit = defineEmits<{ deliver: [] }>();
defineSlots<{ icon: () => unknown }>();
</script>

<template>
  <HoverCard v-if="props.artefact" :open-delay="250" :close-delay="120">
    <HoverCardTrigger as-child>
      <ReleaseLaneNode :label="props.label" :to="props.to" :status="props.status">
        <template #icon><slot name="icon" /></template>
        <span class="truncate">{{ props.artefact.version_name }}</span>
        <span v-if="props.artefact.kind === 'native'" class="text-muted-foreground"
          >({{ props.artefact.version_code }})</span
        >
        <ShieldCheck
          v-if="props.artefact.signed"
          class="text-success size-3.5 shrink-0"
          aria-label="Signed"
        />
        <ShieldAlert v-else class="text-warning size-3.5 shrink-0" aria-label="Unsigned" />
        <span
          v-if="props.artefact.required"
          class="bg-warning-soft text-warning rounded px-1 py-px font-sans text-[9px] font-semibold tracking-wide uppercase"
          >required</span
        >
      </ReleaseLaneNode>
    </HoverCardTrigger>
    <HoverCardContent class="w-80" align="start">
      <ArtefactDetails :artefact="props.artefact" />
    </HoverCardContent>
  </HoverCard>
  <ReleaseLaneNode
    v-else
    :label="props.label"
    :status="props.pending ? null : props.status"
    :pending="props.pending"
  >
    <template #icon><slot name="icon" /></template>
    <span class="text-muted-foreground">{{ props.pending ? "…" : "none" }}</span>
    <template v-if="!props.pending" #aside>
      <GateButton variant="outline" size="xs" :gate="props.deliverGate" @click="emit('deliver')">
        <Rocket />
        Deliver
      </GateButton>
    </template>
  </ReleaseLaneNode>
</template>
