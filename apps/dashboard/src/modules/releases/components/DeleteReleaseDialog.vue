<script setup lang="ts">
import { computed, watch } from "vue";
import { toast } from "vue-sonner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { channelsServing } from "@/shared/delivery/lib/eligibility";
import { artefactLabel } from "@/shared/lib/format";
import type { Artefact, Channel } from "@/shared/types/release";
import type { useReleaseMutations } from "../composables/useReleaseMutations";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  artefact: Artefact | null;
  channels: readonly Channel[];
  remove: ReturnType<typeof useReleaseMutations>["remove"];
}>();

watch(open, (value) => {
  if (value) props.remove.reset();
});

const serving = computed(() =>
  props.artefact ? channelsServing(props.artefact.id, props.channels) : [],
);

function confirm() {
  const artefact = props.artefact;
  if (!artefact) return;
  props.remove.mutate(artefact, {
    onSuccess: () => {
      toast.success(`${artefactLabel(artefact)} deleted`);
      open.value = false;
    },
  });
}
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    :title="`Delete ${props.artefact ? artefactLabel(props.artefact) : ''}`"
    description="The file is removed from storage. Devices that already installed it keep running it."
    confirm-label="Delete release"
    destructive
    :require-text="props.artefact?.version_name ?? null"
    :pending="props.remove.isPending.value"
    :error="props.remove.error.value"
    :disabled="serving.length > 0"
    @confirm="confirm"
  >
    <p v-if="serving.length" class="bg-warning-soft text-warning rounded-md px-3 py-2 text-sm">
      Still served by {{ serving.map((channel) => channel.name).join(", ") }}. Point those channels
      elsewhere first.
    </p>
  </ConfirmDialog>
</template>
