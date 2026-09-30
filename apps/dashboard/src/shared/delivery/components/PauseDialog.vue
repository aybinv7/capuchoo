<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "../../components/ConfirmDialog.vue";
import EnvBadge from "../../components/EnvBadge.vue";
import { formatCount } from "../../lib/format";
import type { Channel } from "../../types/release";
import { useChannelDelivery } from "../composables/useChannelDelivery";
import { useDeliveryActions } from "../composables/useDeliveryActions";

const MIN_REASON = 3;

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ channel: Channel | null }>();

const context = useChannelDelivery(() => props.channel);
const { pause, resume } = useDeliveryActions(context.appId);

const reason = ref("");
const resuming = computed(() => Boolean(props.channel?.paused));
const action = computed(() => (resuming.value ? resume : pause));

watch(open, (value) => {
  if (!value) return;
  pause.reset();
  resume.reset();
  reason.value = "";
});

const ready = computed(
  () => context.gate.value.ok && (resuming.value || reason.value.trim().length >= MIN_REASON),
);

function confirm() {
  const channel = props.channel;
  if (!channel || !ready.value) return;
  const wasPaused = resuming.value;
  action.value.mutate(
    { channelId: channel.id, reason: reason.value.trim() || null },
    {
      onSuccess: () => {
        toast.success(wasPaused ? `${channel.name} resumed` : `${channel.name} paused`);
        open.value = false;
      },
    },
  );
}
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    :title="resuming ? `Resume ${props.channel?.name}` : `Pause ${props.channel?.name}`"
    :description="
      resuming
        ? 'The channel serves its current releases again on the next update check.'
        : 'A paused channel serves nothing until it is resumed. Devices keep what they already run.'
    "
    :confirm-label="resuming ? 'Resume channel' : 'Pause channel'"
    :destructive="!resuming"
    :pending="action.isPending.value"
    :error="action.error.value"
    :disabled="!ready"
    @confirm="confirm"
  >
    <div
      v-if="props.channel"
      class="bg-surface flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <span class="flex items-center gap-2 font-mono font-medium">
        {{ props.channel.name }}
        <EnvBadge :environment="props.channel.environment" />
      </span>
      <span class="text-muted-foreground">
        <template v-if="context.devices.value !== null">
          {{ formatCount(context.devices.value, true) }} devices affected
        </template>
      </span>
    </div>
    <p v-if="!context.gate.value.ok" class="text-warning text-sm">
      {{ context.gate.value.reason }}
    </p>
    <label class="block space-y-1.5 text-sm">
      <span class="text-muted-foreground">
        Reason {{ resuming ? "(optional)" : "(required, kept in the history)" }}
      </span>
      <Textarea v-model="reason" maxlength="500" rows="2" />
    </label>
  </ConfirmDialog>
</template>
