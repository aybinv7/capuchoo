<script setup lang="ts">
import { watch } from "vue";
import { toast } from "vue-sonner";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import type { useDeviceMutations } from "../composables/useDeviceMutations";
import type { Device } from "../types/devices.types";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{
  device: Device | null;
  remove: ReturnType<typeof useDeviceMutations>["remove"];
}>();
const emit = defineEmits<{ removed: [deviceId: string] }>();

watch(open, (value) => {
  if (value) props.remove.reset();
});

function confirm() {
  const device = props.device;
  if (!device) return;
  props.remove.mutate(device.id, {
    onSuccess: () => {
      toast.success("Device removed");
      open.value = false;
      emit("removed", device.id);
    },
  });
}
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    title="Remove this device"
    description="Its record and assignment are deleted. If the app is still installed it registers again on its next update check."
    confirm-label="Remove device"
    destructive
    :pending="props.remove.isPending.value"
    :error="props.remove.error.value"
    @confirm="confirm"
  >
    <div class="bg-surface rounded-lg border px-4 py-3 font-mono text-xs">
      {{ props.device?.device_id }}
    </div>
  </ConfirmDialog>
</template>
