<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { orderChannels } from "@/shared/lib/channels";
import type { Channel } from "@/shared/types/release";
import type { useDeviceMutations } from "../composables/useDeviceMutations";
import type { Device } from "../types/devices.types";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  device: Device | null;
  channels: readonly Channel[];
  assign: ReturnType<typeof useDeviceMutations>["assign"];
}>();

const permissions = useAppPermissions();
const target = ref("");

watch(open, (value) => {
  if (!value) return;
  props.assign.reset();
  target.value = props.device?.assigned_channel_id ?? "";
});

const ordered = computed(() => orderChannels(props.channels).map((row) => row.channel));
const chosen = computed(
  () => props.channels.find((channel) => channel.id === target.value) ?? null,
);
const gate = computed(() => permissions.assignDevice(chosen.value?.environment ?? null));
const unchanged = computed(() => (props.device?.assigned_channel_id ?? "") === target.value);

function confirm() {
  const device = props.device;
  if (!device || !gate.value.ok) return;
  props.assign.mutate(
    { deviceId: device.id, channelId: target.value || null },
    {
      onSuccess: () => {
        toast.success(
          chosen.value ? `Device assigned to ${chosen.value.name}` : "Assignment cleared",
        );
        open.value = false;
      },
    },
  );
}
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    title="Assign a channel"
    description="A dashboard assignment wins over the channel the device selected itself and the one its build reports. Clear it to fall back to those."
    :confirm-label="target ? 'Assign' : 'Clear assignment'"
    :pending="props.assign.isPending.value"
    :error="props.assign.error.value"
    :disabled="!gate.ok || unchanged"
    @confirm="confirm"
  >
    <div class="bg-surface rounded-lg border px-4 py-3 text-sm">
      <div class="font-medium">
        {{ props.device?.model ?? props.device?.device_name ?? "Device" }}
      </div>
      <div class="text-muted-foreground font-mono text-xs">{{ props.device?.device_id }}</div>
      <div class="text-muted-foreground mt-1 text-xs">
        Resolved now to
        <span class="text-foreground font-mono">{{ props.device?.channel_name ?? "nothing" }}</span>
      </div>
    </div>
    <label class="block space-y-1.5 text-sm">
      <span class="text-muted-foreground">Channel</span>
      <NativeSelect v-model="target" class="w-full">
        <NativeSelectOption value="">No assignment (resolve automatically)</NativeSelectOption>
        <NativeSelectOption v-for="channel in ordered" :key="channel.id" :value="channel.id"
          >{{ channel.name }} · {{ channel.environment }}</NativeSelectOption
        >
      </NativeSelect>
    </label>
    <p v-if="chosen" class="flex items-center gap-2 text-xs">
      <EnvBadge :environment="chosen.environment" />
      <span v-if="!gate.ok" class="text-warning">{{ gate.reason }}</span>
      <span v-else class="text-muted-foreground"
        >The device receives this channel's releases on its next check.</span
      >
    </p>
  </ConfirmDialog>
</template>
