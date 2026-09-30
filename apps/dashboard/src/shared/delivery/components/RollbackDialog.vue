<script setup lang="ts">
import { History } from "@lucide/vue";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import ErrorNotice from "../../components/ErrorNotice.vue";
import { artefactLabel } from "../../lib/format";
import type { Channel } from "../../types/release";
import { useChannelDelivery } from "../composables/useChannelDelivery";
import { useDeliveryActions } from "../composables/useDeliveryActions";
import { acceptedCandidates, deliveryCandidates, type ArtefactKind } from "../lib/eligibility";
import ArtefactKindToggle from "./ArtefactKindToggle.vue";
import CandidateList from "./CandidateList.vue";
import DeliverySummary from "./DeliverySummary.vue";

const MIN_REASON = 3;

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ channel: Channel | null; kind?: ArtefactKind }>();

const context = useChannelDelivery(() => props.channel);
const { point } = useDeliveryActions(context.appId);

const kind = ref<ArtefactKind>("ota");
const selectedId = ref<string | null>(null);
const reason = ref("");

watch(open, (value) => {
  if (!value) return;
  point.reset();
  reason.value = "";
  kind.value = props.kind ?? "ota";
  selectedId.value = null;
});

const candidates = computed(() =>
  props.channel
    ? acceptedCandidates(
        deliveryCandidates(props.channel, context.catalog.value, kind.value, {
          servedByBase: context.served.value,
          rollback: true,
        }),
      )
    : [],
);
const selected = computed(
  () => candidates.value.find((candidate) => candidate.artefact.id === selectedId.value) ?? null,
);
const currentOfKind = computed(() =>
  kind.value === "ota" ? context.current.value.bundle : context.current.value.native,
);
const canSubmit = computed(
  () =>
    Boolean(props.channel && selected.value) &&
    context.gate.value.ok &&
    reason.value.trim().length >= MIN_REASON &&
    !point.isPending.value,
);

function setKind(value: ArtefactKind) {
  kind.value = value;
  selectedId.value = null;
}

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
        rollback: true,
        reason: reason.value.trim(),
      },
    },
    {
      onSuccess: () => {
        toast.success(`${channel.name} rolled back to ${artefactLabel(artefact)}`);
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
          <History class="size-4" />
          Roll back {{ props.channel?.name }}
        </DialogTitle>
        <DialogDescription>
          Points the channel at a lower version. Devices accept the downgrade until the next forward
          delivery.
        </DialogDescription>
      </DialogHeader>

      <template v-if="props.channel">
        <Alert v-if="!context.gate.value.ok" class="border-warning/40">
          <AlertDescription>{{ context.gate.value.reason }}</AlertDescription>
        </Alert>

        <ArtefactKindToggle :model-value="kind" @update:model-value="setKind" />

        <CandidateList
          v-model="selectedId"
          :candidates="candidates"
          :empty-label="
            currentOfKind
              ? `Nothing lower than ${currentOfKind.version_name} can be served on ${props.channel.name}.`
              : `${props.channel.name} serves no ${kind === 'ota' ? 'bundle' : 'native build'} yet, so there is nothing to roll back.`
          "
        />

        <DeliverySummary
          v-if="selected"
          :channel="props.channel"
          :kind="kind"
          :from="selected.preview.from"
          :to="selected.artefact"
          :devices="context.devices.value"
          direction="downgrade"
        />

        <label class="block space-y-1.5 text-sm">
          <span class="text-muted-foreground">Reason (required, kept in the history)</span>
          <Textarea
            v-model="reason"
            maxlength="500"
            rows="2"
            placeholder="Crash spike after 1.4.2, incident INC-231…"
          />
        </label>

        <ErrorNotice v-if="point.error.value" :error="point.error.value" />
      </template>

      <DialogFooter>
        <Button variant="outline" :disabled="point.isPending.value" @click="open = false"
          >Cancel</Button
        >
        <Button variant="destructive" :disabled="!canSubmit" @click="submit">
          <Spinner v-if="point.isPending.value" />
          Roll back{{ selected ? ` to ${artefactLabel(selected.artefact)}` : "" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
