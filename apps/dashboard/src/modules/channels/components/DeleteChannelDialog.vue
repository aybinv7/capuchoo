<script setup lang="ts">
import { computed, watch } from "vue";
import { toast } from "vue-sonner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { clientsOf } from "@/shared/lib/channels";
import type { Channel } from "@/shared/types/release";
import { useChannelMutations } from "../composables/useChannelMutations";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ channel: Channel | null; channels: readonly Channel[] }>();
const emit = defineEmits<{ deleted: [channel: Channel] }>();

const { remove } = useChannelMutations(() => props.channel?.app_id ?? "");

watch(open, (value) => {
  if (value) remove.reset();
});

const clients = computed(() => (props.channel ? clientsOf(props.channel, props.channels) : []));
const serving = computed(
  () => Boolean(props.channel?.current_bundle_id) || Boolean(props.channel?.current_native_id),
);

function confirm() {
  const channel = props.channel;
  if (!channel) return;
  remove.mutate(channel.id, {
    onSuccess: () => {
      toast.success(`${channel.name} deleted`);
      open.value = false;
      emit("deleted", channel);
    },
  });
}
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    :title="`Delete ${props.channel?.name}`"
    description="Devices on this channel stop receiving updates from it. Its history is deleted with it."
    confirm-label="Delete channel"
    destructive
    :require-text="props.channel?.name ?? null"
    :pending="remove.isPending.value"
    :error="remove.error.value"
    :disabled="clients.length > 0"
    @confirm="confirm"
  >
    <p v-if="clients.length" class="bg-warning-soft text-warning rounded-md px-3 py-2 text-sm">
      Client channels follow this one: {{ clients.map((client) => client.name).join(", ") }}. Delete
      them first.
    </p>
    <p v-else-if="serving" class="text-muted-foreground text-sm">
      The channel currently serves a release. Deleting it does not delete the release.
    </p>
  </ConfirmDialog>
</template>
