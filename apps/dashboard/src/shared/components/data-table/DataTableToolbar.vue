<script setup lang="ts" generic="T">
import { RefreshCw, X } from "@lucide/vue";
import type { Table } from "@tanstack/vue-table";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DataTableDensityMenu from "./DataTableDensityMenu.vue";
import DataTableExportMenu from "./DataTableExportMenu.vue";
import DataTableFacetedFilter from "./DataTableFacetedFilter.vue";
import DataTableGroupMenu from "./DataTableGroupMenu.vue";
import DataTableSearch from "./DataTableSearch.vue";
import DataTableViewOptions from "./DataTableViewOptions.vue";
import type { DataTableFacet, DataTableFeatures, Density, ExportFormat } from "./types";

const search = defineModel<string>("search", { required: true });
const density = defineModel<Density>("density", { required: true });

const props = defineProps<{
  table: Table<T>;
  features: DataTableFeatures;
  facets: readonly DataTableFacet[];
  facetCounts: boolean;
  filtered: boolean;
  searchPlaceholder?: string;
  exportScope: string;
  exportDisabled: boolean;
  refreshable: boolean;
  refreshing: boolean;
  grouping: { enabled: boolean; available: boolean; columns: readonly string[] };
}>();
const emit = defineEmits<{
  resetFilters: [];
  resetLayout: [];
  export: [format: ExportFormat];
  refresh: [];
  toggleGroup: [id: string];
  expandAll: [open: boolean];
}>();

const facetColumns = computed(() =>
  props.facets
    .map((facet) => ({ facet, column: props.table.getColumn(facet.columnId) }))
    .filter((entry) => entry.column !== undefined),
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <DataTableSearch
      v-if="props.features.search"
      v-model="search"
      :placeholder="props.searchPlaceholder"
    />
    <DataTableFacetedFilter
      v-for="entry in facetColumns"
      :key="entry.facet.columnId"
      :column="entry.column!"
      :facet="entry.facet"
      :counts="props.facetCounts"
    />
    <Button
      v-if="props.filtered"
      variant="ghost"
      size="sm"
      class="h-8 px-2"
      @click="emit('resetFilters')"
    >
      Reset
      <X />
    </Button>
    <div class="ml-auto flex items-center gap-2">
      <slot />
      <DataTableGroupMenu
        v-if="props.grouping.enabled"
        :table="props.table"
        :grouping="props.grouping.columns"
        :available="props.grouping.available"
        @toggle="emit('toggleGroup', $event)"
        @expand-all="emit('expandAll', $event)"
      />
      <DataTableDensityMenu v-if="props.features.density" v-model="density" />
      <DataTableViewOptions
        v-if="props.features.viewOptions"
        :table="props.table"
        @reset="emit('resetLayout')"
      />
      <DataTableExportMenu
        v-if="props.features.export"
        :scope="props.exportScope"
        :disabled="props.exportDisabled"
        @export="emit('export', $event)"
      />
      <Button
        v-if="props.refreshable"
        variant="outline"
        size="icon-sm"
        class="size-8"
        aria-label="Refresh"
        :disabled="props.refreshing"
        @click="emit('refresh')"
      >
        <RefreshCw :class="cn(props.refreshing && 'animate-spin')" />
      </Button>
    </div>
  </div>
</template>
