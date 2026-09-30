<script setup lang="ts">
import { Download, Ellipsis, Pencil, Rocket, Trash2 } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { previewPointer } from "@/shared/delivery/lib/eligibility";
import { orderChannels } from "@/shared/lib/channels";
import type { Artefact, Channel, ReleaseCatalog } from "@/shared/types/release";

/** Refusals that no history can change; the rest are settled in the deliver dialog. */
const DEFINITIVE = new Set(["other-app", "unflavoured", "flavour-mismatch", "platform-disabled"]);

const props = defineProps<{ artefact: Artefact; catalog: ReleaseCatalog; served: boolean }>();
const emit = defineEmits<{
  deliver: [channel: Channel];
  edit: [];
  download: [];
  delete: [];
}>();

const permissions = useAppPermissions();

const targets = computed(() => {
  const assumeServed = new Set([props.artefact.id]);
  return orderChannels(props.catalog.channels).map(({ channel }) => {
    const { verdict } = previewPointer({
      channel,
      artefact: props.artefact,
      catalog: props.catalog,
      servedByBase: assumeServed,
    });
    const gate = permissions.deliver(channel.environment);
    const blocked = !verdict.ok && DEFINITIVE.has(verdict.reason);
    const current =
      channel.current_bundle_id === props.artefact.id ||
      channel.current_native_id === props.artefact.id;
    return {
      channel,
      disabled: blocked || !gate.ok || current,
      hint: current
        ? "serving"
        : !gate.ok
          ? gate.reason
          : blocked && !verdict.ok
            ? verdict.message
            : null,
    };
  });
});
const editGate = computed(() => permissions.editRelease(props.artefact.flavour));
const deleteGate = computed(() => permissions.deleteRelease.value);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="`Actions for ${props.artefact.version_name}`"
      >
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Rocket class="size-4" />
          Deliver to
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent class="w-72">
          <DropdownMenuItem
            v-for="target in targets"
            :key="target.channel.id"
            :disabled="target.disabled"
            :title="target.hint ?? undefined"
            @select="emit('deliver', target.channel)"
          >
            <span class="flex-1 truncate font-mono text-xs">{{ target.channel.name }}</span>
            <span v-if="target.hint === 'serving'" class="text-success text-[10px] uppercase"
              >serving</span
            >
            <EnvBadge v-else :environment="target.channel.environment" size="sm" />
          </DropdownMenuItem>
          <DropdownMenuLabel
            v-if="targets.length === 0"
            class="text-muted-foreground text-xs font-normal"
            >No channels</DropdownMenuLabel
          >
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem
        :disabled="!editGate.ok"
        :title="editGate.ok ? undefined : editGate.reason"
        @select="emit('edit')"
      >
        <Pencil class="size-4" />
        Edit notes and flags
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('download')">
        <Download class="size-4" />
        Download
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        :disabled="!deleteGate.ok || props.served"
        :title="
          !deleteGate.ok
            ? deleteGate.reason
            : props.served
              ? 'Served by a channel; point it elsewhere first.'
              : undefined
        "
        @select="emit('delete')"
      >
        <Trash2 class="size-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
