<script setup lang="ts">
import { ScrollText } from "@lucide/vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import VirtualRows from "@/shared/components/VirtualRows.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useAuditLog } from "../composables/useAuditLog";
import { describeDetails, detailChannel } from "../lib/describe-details";
import type { AuditEntry } from "../types/audit.types";

const COLUMNS = "8rem minmax(10rem,1fr) 11rem 8rem minmax(12rem,2fr)";

const { appId } = useCurrentApp();
const { entries, isPending, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
  useAuditLog(appId);

function loadMore() {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}

const actor = (entry: AuditEntry) =>
  entry.actor_email ?? (entry.actor_api_key_id ? "API key" : "system");
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Audit log"
      description="Every change to this app, who made it and from which credential. Admins only."
    />
    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <div v-else-if="isPending" class="space-y-2">
      <Skeleton v-for="index in 8" :key="index" class="h-10 w-full" />
    </div>
    <EmptyState v-else-if="entries.length === 0" :icon="ScrollText" title="Nothing recorded yet" />
    <VirtualRows
      v-else
      :items="entries"
      :row-height="44"
      :columns="COLUMNS"
      :item-key="(entry) => entry.id"
      @reach-end="loadMore"
    >
      <template #header>
        <span>When</span>
        <span>Actor</span>
        <span>Action</span>
        <span>Target</span>
        <span>Details</span>
      </template>
      <template #row="{ item }">
        <span class="text-muted-foreground text-xs"><RelativeTime :value="item.created_at" /></span>
        <span class="truncate text-xs">{{ actor(item) }}</span>
        <span class="truncate font-mono text-xs">{{ item.action }}</span>
        <span class="text-muted-foreground truncate font-mono text-xs">{{
          detailChannel(item.details) ?? item.target_type
        }}</span>
        <span
          class="text-muted-foreground truncate text-xs"
          :title="describeDetails(item.details)"
          >{{ describeDetails(item.details) }}</span
        >
      </template>
      <template #footer>
        <div
          v-if="isFetchingNextPage"
          class="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs"
        >
          <Spinner class="size-3" />
          Loading older entries
        </div>
      </template>
    </VirtualRows>
  </PageContainer>
</template>
