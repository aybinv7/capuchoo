<script setup lang="ts">
import { useRouter } from "vue-router";
import BuildStatusBadge from "@/shared/components/BuildStatusBadge.vue";
import { DataTable, type DataTableFacet } from "@/shared/components/data-table";
import ElapsedTime from "@/shared/components/ElapsedTime.vue";
import EnvBadge from "@/shared/components/EnvBadge.vue";
import RelativeTime from "@/shared/components/RelativeTime.vue";
import { RouteName } from "@/shared/router/route-names";
import type { Build } from "@/shared/types/build";
import { BUILD_COLUMNS } from "../lib/build-columns";
import BuildSourceCell from "./BuildSourceCell.vue";
import PipelineRowSummary from "./PipelineRowSummary.vue";

const search = defineModel<string>("search", { default: "" });

const props = defineProps<{
  builds: readonly Build[];
  loading: boolean;
  refreshing: boolean;
  appName: string;
}>();
const emit = defineEmits<{ refresh: [] }>();

const FACETS: DataTableFacet[] = [
  { columnId: "status", title: "Status" },
  { columnId: "kind", title: "Kind" },
  { columnId: "channel", title: "Channel" },
  { columnId: "flavour", title: "Flavour" },
];

const router = useRouter();
const open = (build: Build) =>
  router.push({ name: RouteName.build, params: { buildId: build.id } });
</script>

<template>
  <DataTable
    v-model:search="search"
    :data="props.builds"
    :columns="BUILD_COLUMNS"
    :get-row-id="(build) => build.id"
    table-id="builds"
    :export-name="`${props.appName}-builds`"
    :facets="FACETS"
    search-placeholder="Version, run, channel, branch, commit, author"
    :loading="props.loading"
    refreshable
    :refreshing="props.refreshing"
    row-clickable
    @row-click="open"
    @refresh="emit('refresh')"
  >
    <template #cell-status="{ row }">
      <BuildStatusBadge :status="row.status" />
    </template>
    <template #cell-kind="{ row }">
      <span class="bg-muted rounded px-1 font-mono text-[10px] uppercase">{{ row.kind }}</span>
    </template>
    <template #cell-release="{ row }">
      <PipelineRowSummary v-if="row.kind === 'pipeline'" :build="row" />
      <div v-else class="flex items-center gap-2">
        <span class="bg-muted rounded px-1 font-mono text-[10px] uppercase">{{ row.kind }}</span>
        <span class="font-mono text-sm">{{ row.version_name ?? "—" }}</span>
        <span v-if="row.version_code" class="text-muted-foreground font-mono text-xs"
          >({{ row.version_code }})</span
        >
      </div>
    </template>
    <template #cell-channel="{ row }">
      <div class="flex items-center gap-2">
        <span class="font-mono text-xs">{{ row.channel_name ?? "—" }}</span>
        <EnvBadge v-if="row.flavour" :environment="row.flavour" size="sm" />
      </div>
    </template>
    <template #cell-flavour="{ row }">
      <EnvBadge v-if="row.flavour" :environment="row.flavour" size="sm" />
    </template>
    <template #cell-source="{ row }">
      <div class="max-w-[22rem]"><BuildSourceCell :build="row" /></div>
    </template>
    <template #cell-actor="{ value }">
      <span class="text-muted-foreground max-w-40 truncate text-xs">{{ value || "—" }}</span>
    </template>
    <template #cell-started="{ row }">
      <span class="text-muted-foreground text-xs"
        ><RelativeTime :value="row.started_at ?? row.created_at"
      /></span>
    </template>
    <template #cell-duration="{ row }">
      <span class="text-muted-foreground text-xs"
        ><ElapsedTime :from="row.started_at ?? row.created_at" :to="row.finished_at"
      /></span>
    </template>
    <template #cell-error="{ row }">
      <span class="text-destructive text-xs" :title="row.error ?? undefined">{{
        row.error ?? ""
      }}</span>
    </template>
  </DataTable>
</template>
