<script setup lang="ts">
import { Rocket } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import ErrorNotice from "../../components/ErrorNotice.vue";
import { artefactLabel } from "../../lib/format";
import type { Channel } from "../../types/release";
import { useChannelDelivery } from "../composables/useChannelDelivery";
import { useDeliveryActions } from "../composables/useDeliveryActions";
import { deliveryCandidates, findArtefact, type ArtefactKind } from "../lib/eligibility";
import ArtefactKindToggle from "./ArtefactKindToggle.vue";
import CandidateList from "./CandidateList.vue";
import DeliverySummary from "./DeliverySummary.vue";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{
  channel: Channel | null;
  artefactId?: string | null;
  kind?: ArtefactKind;
}>();

const context = useChannelDelivery(() => props.channel);
const { point } = useDeliveryActions(context.appId);

const kind = ref<ArtefactKind>("ota");
const selectedId = ref<string | null>(null);
const reason = ref("");
const typed = ref("");

watch(open, (value) => {
  if (!value) return;
  point.reset();
  reason.value = "";
  typed.value = "";
  const preset = props.artefactId ? findArtefact(context.catalog.value, props.artefactId) : null;
  kind.value = preset?.kind ?? props.kind ?? "ota";
  selectedId.value = preset?.id ?? null;
});

function setKind(value: ArtefactKind) {
  kind.value = value;
  selectedId.value = null;
}

const candidates = computed(() =>
  props.channel
    ? deliveryCandidates(props.channel, context.catalog.value, kind.value, {
        servedByBase: context.served.value,
      })
    : [],
);
const selected = computed(
  () => candidates.value.find((candidate) => candidate.artefact.id === selectedId.value) ?? null,
);
const needsTypedName = computed(() => props.channel?.environment === "prod");
const canSubmit = computed(
  () =>
    Boolean(props.channel && selected.value?.preview.verdict.ok) &&
    context.gate.value.ok &&
    !point.isPending.value &&
    (!needsTypedName.value || typed.value.trim() === props.channel?.name),
);

function submit() {
  const channel = props.channel;
  const choice = selected.value;
  if (!channel || !choice || !canSubmit.value) return;
  const artefact = choice.artefact;
  point.mutate(
    {
      channelId: channel.id,
      input: {
        ...(artefact.kind === "ota" ? { bundle_id: artefact.id } : { native_id: artefact.id }),
        reason: reason.value.trim() || null,
      },
    },
    {
      onSuccess: () => {
        toast.success(`${artefactLabel(artefact)} is live on ${channel.name}`);
        open.value = false;
      },
    },
  );
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Rocket class="size-4" />
          Deliver to {{ props.channel?.name }}
        </DialogTitle>
        <DialogDescription>
          Points the channel at a release. Devices pick it up on their next update check.
        </DialogDescription>
      </DialogHeader>

      <template v-if="props.channel">
        <Alert v-if="!context.gate.value.ok" class="border-warning/40">
          <AlertDescription>{{ context.gate.value.reason }}</AlertDescription>
        </Alert>

        <div class="flex items-center justify-between gap-2">
          <ArtefactKindToggle :model-value="kind" @update:model-value="setKind" />
          <span
            v-if="context.pending.value"
            class="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <Spinner class="size-3" />
            Checking what the base channel served
          </span>
        </div>

        <CandidateList
          v-model="selectedId"
          :candidates="candidates"
          :empty-label="`No ${kind === 'ota' ? 'bundle' : 'native build'} can be delivered to ${props.channel.name} right now.`"
        />

        <DeliverySummary
          v-if="selected"
          :channel="props.channel"
          :kind="kind"
          :from="selected.preview.from"
          :to="selected.artefact"
          :devices="context.devices.value"
          :direction="selected.preview.verdict.ok ? selected.preview.verdict.direction : null"
        />

        <label class="block space-y-1.5 text-sm">
          <span class="text-muted-foreground">Note for the history (optional)</span>
          <Textarea
            v-model="reason"
            maxlength="500"
            rows="2"
            placeholder="Why this release, ticket, incident…"
          />
        </label>

        <label v-if="needsTypedName && selected" class="block space-y-1.5 text-sm">
          <span class="text-muted-foreground">
            Production delivery. Type
            <code class="text-foreground font-mono">{{ props.channel.name }}</code> to confirm
          </span>
          <Input v-model="typed" autocomplete="off" spellcheck="false" class="font-mono" />
        </label>

        <ErrorNotice v-if="point.error.value" :error="point.error.value" />
      </template>

      <DialogFooter>
        <Button variant="outline" :disabled="point.isPending.value" @click="open = false"
          >Cancel</Button
        >
        <Button :disabled="!canSubmit" @click="submit">
          <Spinner v-if="point.isPending.value" />
          Deliver{{ selected ? ` ${artefactLabel(selected.artefact)}` : "" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
