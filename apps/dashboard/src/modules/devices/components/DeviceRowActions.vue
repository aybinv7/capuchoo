<script setup lang="ts">
import { ArrowRightLeft, Ellipsis, Trash2 } from "@lucide/vue";
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
import type { Device } from "../types/devices.types";

const props = defineProps<{ device: Device }>();
const emit = defineEmits<{ assign: []; remove: [] }>();

const permissions = useAppPermissions();
const assignGate = computed(() => permissions.assignDevice(null));
const removeGate = computed(() => permissions.removeDevice.value);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" :aria-label="`Actions for ${props.device.device_id}`">
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuItem
        :disabled="!assignGate.ok"
        :title="assignGate.ok ? undefined : assignGate.reason"
        @select="emit('assign')"
      >
        <ArrowRightLeft class="size-4" />
        Assign channel
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
