<script setup lang="ts">
import { ScrollText } from "@lucide/vue";
import { computed } from "vue";
import { DataTable, type DataTableFacet } from "@/shared/components/data-table";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorNotice from "@/shared/components/ErrorNotice.vue";
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { useCurrentApp } from "@/shared/composables/useCurrentApp";
import { useQueryParam } from "@/shared/composables/useQueryParam";
import { useAuditLog } from "../composables/useAuditLog";
import { AUDIT_COLUMNS } from "../lib/audit-columns";

const FACETS: DataTableFacet[] = [
  { columnId: "action", title: "Action" },
  { columnId: "actor", title: "Actor" },
];

const { appId, app } = useCurrentApp();
const {
  entries,
  isPending,
  isFetching,
  error,
  refetch,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
} = useAuditLog(appId);

const search = useQueryParam("q", "");
const empty = computed(() => !isPending.value && entries.value.length === 0);

function loadMore() {
  if (hasNextPage.value && !isFetchingNextPage.value) void fetchNextPage();
}
</script>

<template>
  <PageContainer width="wide">
    <PageHeader
      title="Audit log"
      description="Every change to this app, who made it and from which credential. Admins only. Search and filters apply to the entries loaded so far."
    />
    <ErrorNotice v-if="error" :error="error" :retry="refetch" />
    <EmptyState v-else-if="empty" :icon="ScrollText" title="Nothing recorded yet" />
    <DataTable
      v-else
      v-model:search="search"
      :data="entries"
      :columns="AUDIT_COLUMNS"
      :get-row-id="(entry) => entry.id"
      table-id="audit"
      :export-name="`${app?.name ?? 'app'}-audit`"
      :facets="FACETS"
      search-placeholder="Search loaded entries"
      :has-more="Boolean(hasNextPage)"
      :loading="isPending"
      :loading-more="isFetchingNextPage"
      refreshable
      :refreshing="isFetching && !isPending && !isFetchingNextPage"
      @load-more="loadMore"
      @refresh="refetch"
    >
      <template #cell-when="{ row }">
        <span class="text-muted-foreground text-xs"><RelativeTime :value="row.created_at" /></span>
      </template>
      <template #cell-actor="{ value }">
        <span class="truncate text-xs">{{ value }}</span>
      </template>
      <template #cell-action="{ value }">
        <span class="font-mono text-xs">{{ value }}</span>
      </template>
      <template #cell-target="{ value }">
        <span class="text-muted-foreground font-mono text-xs">{{ value }}</span>
      </template>
      <template #cell-details="{ value }">
        <span class="text-muted-foreground text-xs" :title="String(value)">{{ value }}</span>
      </template>
    </DataTable>
  </PageContainer>
</template>
