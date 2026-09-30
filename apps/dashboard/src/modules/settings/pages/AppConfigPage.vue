<script setup lang="ts">
import { Pencil, Plus, Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import GateButton from "@/shared/components/GateButton.vue";
import { useAppPermissions } from "@/shared/composables/useAppPermissions";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useCatalog } from "@/shared/queries/useCatalog";
import ConfigEntryDialog from "../components/ConfigEntryDialog.vue";
import SettingsSection from "../components/SettingsSection.vue";
import { useRemoteConfig } from "../composables/useRemoteConfig";
import type { ConfigEntry } from "../types/settings.types";

const { appId } = useCurrentApp();
const permissions = useAppPermissions();
const { channels } = useCatalog(appId);
const { entries, save, remove } = useRemoteConfig(appId);

const gate = computed(() => permissions.administer.value);
const editing = ref<ConfigEntry | null>(null);
const dialogOpen = ref(false);
const deleting = ref<ConfigEntry | null>(null);
const deleteOpen = ref(false);

function edit(entry: ConfigEntry | null) {
  editing.value = entry;
  dialogOpen.value = true;
}

function askDelete(entry: ConfigEntry) {
  deleting.value = entry;
  deleteOpen.value = true;
}

function confirmDelete() {
  const entry = deleting.value;
  if (!entry) return;
  remove.mutate(entry.id, { onSuccess: () => (deleteOpen.value = false) });
}
</script>

<template>
  <SettingsSection
    title="Remote config"
    description="Key-value settings delivered with update responses, without a release."
  >
    <template #actions>
      <GateButton size="sm" :gate="gate" @click="edit(null)">
        <Plus />
        Add value
      </GateButton>
    </template>

    <ErrorNotice v-if="entries.error.value" :error="entries.error.value" :retry="entries.refetch" />
    <Skeleton v-else-if="entries.isPending.value" class="h-32 w-full" />
    <p v-else-if="!entries.data.value?.length" class="text-muted-foreground text-sm">
      No config values yet.
    </p>
    <div v-else class="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader class="bg-surface">
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Type</TableHead>
            <TableHead class="w-[40%]">Value</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="entry in entries.data.value" :key="entry.id">
            <TableCell class="font-mono text-sm">{{ entry.key }}</TableCell>
            <TableCell>
              <div class="flex items-center gap-1.5">
                <EnvBadge
                  v-if="entry.environment !== 'all'"
                  :environment="entry.environment"
                  size="sm"
                />
                <span v-else class="text-muted-foreground text-xs">all</span>
                <span v-if="entry.channel" class="font-mono text-xs">· {{ entry.channel }}</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground font-mono text-xs">{{
              entry.value_type
            }}</TableCell>
            <TableCell class="max-w-0 truncate font-mono text-xs" :title="entry.value">{{
              entry.value
            }}</TableCell>
            <TableCell class="text-right">
              <div v-if="gate.ok" class="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="`Edit ${entry.key}`"
                  @click="edit(entry)"
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="`Delete ${entry.key}`"
                  @click="askDelete(entry)"
                >
                  <Trash2 />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ConfigEntryDialog
      v-model:open="dialogOpen"
      :entry="editing"
      :channels="channels"
      :save="save"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="`Delete ${deleting?.key}`"
      description="Devices stop receiving this value, or fall back to a broader one, on their next check."
      confirm-label="Delete value"
      destructive
      :pending="remove.isPending.value"
      @confirm="confirmDelete"
    />
  </SettingsSection>
</template>
