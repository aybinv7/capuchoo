<script setup lang="ts">
import { describeCap } from "@capuchoo/core";
import { KeyRound, Plus } from "@lucide/vue";
import { ref } from "vue";
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
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { useSession } from "@/shared/composables/useSession";
import { formatDateTime } from "@/shared/lib/format";
import CreateApiKeyDialog from "../components/CreateApiKeyDialog.vue";
import { useApiKeys } from "../composables/useApiKeys";
import type { ApiKey } from "../types/settings.types";

const { keys, create, revoke } = useApiKeys();
const { apps } = useSession();

const creating = ref(false);
const revoking = ref<ApiKey | null>(null);
const revokeOpen = ref(false);

const appName = (id: string | null) =>
  id ? (apps.value.find((app) => app.id === id)?.name ?? "an app you no longer reach") : "all apps";

const expired = (key: ApiKey) =>
  Boolean(key.expires_at) && Date.parse(key.expires_at as string) < Date.now();

function askRevoke(key: ApiKey) {
  revoking.value = key;
  revokeOpen.value = true;
}

function confirmRevoke() {
  const key = revoking.value;
  if (!key) return;
  revoke.mutate(key.id, { onSuccess: () => (revokeOpen.value = false) });
}
import AgentConnectCard from "../components/AgentConnectCard.vue";
</script>

<template>
  <PageContainer>
    <PageHeader
      title="API keys"
      description="Keys you minted for the CLI, CI and AI agents. Each acts as you, limited by its app and role cap."
    >
      <template #actions>
        <Button @click="creating = true">
          <Plus />
          New key
        </Button>
      </template>
    </PageHeader>

    <ErrorNotice v-if="keys.error.value" :error="keys.error.value" :retry="keys.refetch" />
    <Skeleton v-else-if="keys.isPending.value" class="h-40 w-full" />
    <EmptyState
      v-else-if="!keys.data.value?.length"
      :icon="KeyRound"
      title="No API keys"
      description="capuchoo login creates one for the CLI; create a capped one here for CI."
    />
    <div v-else class="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader class="bg-surface">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Cap</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="key in keys.data.value" :key="key.id">
            <TableCell>
              <div class="font-medium">{{ key.name }}</div>
              <div class="text-muted-foreground font-mono text-xs">{{ key.key_prefix }}…</div>
            </TableCell>
            <TableCell class="text-sm">{{ appName(key.app_id) }}</TableCell>
            <TableCell class="text-sm">{{ describeCap(key.role) }}</TableCell>
            <TableCell class="text-muted-foreground text-xs"
              ><RelativeTime :value="key.last_used_at"
            /></TableCell>
            <TableCell
              class="text-xs"
              :class="expired(key) ? 'text-destructive' : 'text-muted-foreground'"
            >
              {{ key.expires_at ? formatDateTime(key.expires_at) : "never" }}
            </TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" class="text-destructive" @click="askRevoke(key)"
                >Revoke</Button
              >
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <CreateApiKeyDialog v-model:open="creating" :create="create" />
    <ConfirmDialog
      v-model:open="revokeOpen"
      :title="`Revoke ${revoking?.name}`"
      description="Anything using this key is refused from its next request."
      confirm-label="Revoke key"
      destructive
      :pending="revoke.isPending.value"
      @confirm="confirmRevoke"
    />
    <AgentConnectCard />
  </PageContainer>
</template>
