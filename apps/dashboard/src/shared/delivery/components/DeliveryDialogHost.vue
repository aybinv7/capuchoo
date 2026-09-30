<script setup lang="ts">
import { computed } from "vue";
import { useCatalog } from "../../queries/useCatalog";
import type { DeliveryDialogController } from "../composables/useDeliveryDialogs";
import DeliverDialog from "./DeliverDialog.vue";
import PauseDialog from "./PauseDialog.vue";
import RollbackDialog from "./RollbackDialog.vue";

const props = defineProps<{ controller: DeliveryDialogController }>();

const state = computed(() => props.controller.state);
const { channels } = useCatalog(() => state.value.channel?.app_id ?? "");
const channel = computed(() => {
  const chosen = state.value.channel;
  if (!chosen) return null;
  return channels.value.find((entry) => entry.id === chosen.id) ?? chosen;
});
</script>

<template>
  <DeliverDialog
    :open="state.active === 'deliver'"
    :channel="channel"
    :artefact-id="state.artefactId"
    @update:open="props.controller.setOpen('deliver', $event)"
  />
  <RollbackDialog
    :open="state.active === 'rollback'"
    :channel="channel"
    :kind="state.kind"
    @update:open="props.controller.setOpen('rollback', $event)"
  />
  <PauseDialog
    :open="state.active === 'pause'"
    :channel="channel"
    @update:open="props.controller.setOpen('pause', $event)"
  />
</template>
