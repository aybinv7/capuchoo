<script setup lang="ts">
import { Copy, Ellipsis, Fingerprint, Trash2 } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCopyToast } from "@/shared/composables/useCopyToast";
import type { Device } from "../types/devices.types";

const props = defineProps<{ device: Device }>();
const emit = defineEmits<{ remove: [] }>();

const permissions = useAppPermissions();
const removeGate = computed(() => permissions.removeDevice.value);
const { copyText } = useCopyToast();
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon-sm" aria-label="More device actions">
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuItem @select="copyText(props.device.device_id, 'device id')">
        <Copy class="size-4" />
        Copy device id
      </DropdownMenuItem>
      <DropdownMenuItem
        :disabled="!props.device.custom_id"
        @select="props.device.custom_id && copyText(props.device.custom_id, 'custom id')"
      >
        <Fingerprint class="size-4" />
        Copy custom id
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        :disabled="!removeGate.ok"
        :title="removeGate.ok ? undefined : removeGate.reason"
        @select="emit('remove')"
      >
        <Trash2 class="size-4" />
        Remove device
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
