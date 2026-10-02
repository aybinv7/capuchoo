<script setup lang="ts" generic="T">
import { FlexRender, type ColumnFiltersState } from "@tanstack/vue-table";
import { computed, ref, toRef, useSlots, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCount } from "@/shared/lib/format";
import { useDataTable } from "./composables/useDataTable";
import DataTableBulkBar from "./DataTableBulkBar.vue";
import DataTableGroupRow from "./DataTableGroupRow.vue";
import DataTableHeaderCell from "./DataTableHeaderCell.vue";
import DataTablePagination from "./DataTablePagination.vue";
import DataTableToolbar from "./DataTableToolbar.vue";
import { download, exportColumns, exportFilename, toCsv, toJson } from "./lib/export";
import { pinningEdge, pinningStyle } from "./lib/pinning";
import {
  DEFAULT_FEATURES,
  type AnyColumnDef,
  type DataTableFacet,
  type DataTableFeatures,
  type Density,
  type ExportFormat,
  type GroupingState,
} from "./types";

const props = withDefaults(
  defineProps<{
    data: readonly T[];
    columns: AnyColumnDef<T>[];
    getRowId: (row: T) => string;
    /** Persists density, page size and column layout under this key. */
    tableId?: string;
    exportName?: string;
    facets?: readonly DataTableFacet[];
    features?: Partial<DataTableFeatures>;
    searchPlaceholder?: string;
    loading?: boolean;
    refreshable?: boolean;
    refreshing?: boolean;
    /** Search and facets are applied by the server; the rows arrive filtered. */
    serverFiltering?: boolean;
    total?: number | null;
    hasMore?: boolean;
    loadingMore?: boolean;
    rowClickable?: boolean;
    rowClass?: (row: T) => string | false | undefined;
    pageSize?: number;
    /** Maximum height of the scrolling body; the header stays in view. */
    height?: string;
  }>(),
  {
    exportName: undefined,
    tableId: undefined,
    facets: () => [],
    features: () => ({}),
    searchPlaceholder: "Search",
    total: null,
    pageSize: 20,
    height: "calc(100svh - 19rem)",
    rowClass: undefined,
  },
);

const search = defineModel<string>("search", { default: "" });
const filters = defineModel<ColumnFiltersState>("filters", { default: () => [] });

const emit = defineEmits<{ refresh: []; loadMore: []; rowClick: [row: T] }>();

defineSlots<
  {
    toolbar?: () => unknown;
    "bulk-actions"?: (scope: { rows: T[]; clear: () => void }) => unknown;
    empty?: () => unknown;
  } & {
    [name: `cell-${string}`]: ((scope: { row: T; value: unknown }) => unknown) | undefined;
  }
>();
const slots = useSlots();

const features = computed<DataTableFeatures>(() => ({ ...DEFAULT_FEATURES, ...props.features }));

const controller = useDataTable<T>({
  data: toRef(props, "data"),
  columns: toRef(props, "columns"),
  getRowId: (row) => props.getRowId(row),
  features,
  search,
  filters,
  serverFiltering: () => props.serverFiltering,
  incomplete: () => props.hasMore,
  tableId: props.tableId,
  pageSize: props.pageSize,
});
const { table, density, selectedRows, filtered, columnOrder, leafRows } = controller;
const groupingState = computed<GroupingState>(() => ({
  enabled: controller.groupingEnabled.value,
  available: controller.groupable.value,
  columns: controller.grouping.value,
}));

const CELL: Record<Density, string> = {
  compact: "h-8 px-3 py-1 text-xs",
  normal: "h-11 px-3 py-2",
  comfortable: "h-14 px-3 py-3",
};
const PINNED_CELL =
  "bg-background group-hover/row:bg-[color-mix(in_oklch,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted";
const IGNORED_TARGETS =
  "a,button,input,select,textarea,label,[role=checkbox],[role=menuitem],[data-row-ignore]";

const rows = computed(() => table.getRowModel().rows);
const nestedIndent = (depth: number) =>
  depth > 0 ? { paddingLeft: `${12 + depth * 20}px` } : undefined;
const visibleColumns = computed(() => table.getVisibleLeafColumns());
const showSkeleton = computed(() => props.loading && props.data.length === 0);

const exportScope = computed(() => {
  if (selectedRows.value.length > 0)
    return `${formatCount(selectedRows.value.length, true)} selected row(s)`;
  const count = leafRows.value.length;
  return `${formatCount(count, true)} row(s)${props.hasMore ? " loaded so far" : ""}`;
});

function exportAs(format: ExportFormat, onlySelected = false) {
  const source =
    onlySelected || selectedRows.value.length > 0 ? selectedRows.value : leafRows.value;
  try {
    const columns = exportColumns(table.getVisibleLeafColumns());
    const content = format === "csv" ? toCsv(source, columns) : toJson(source, columns);
    download(content, exportFilename(props.exportName ?? props.tableId ?? "export"), format);
  } catch (error) {
    toast.error("Export failed", {
      description: error instanceof Error ? error.message : "The browser refused the download.",
    });
  }
}

function onRowClick(row: T, event: MouseEvent) {
  if (!props.rowClickable) return;
  if (event.target instanceof Element && event.target.closest(IGNORED_TARGETS)) return;
  emit("rowClick", row);
}

const advancePending = ref(false);

function next() {
  if (table.getCanNextPage()) {
    table.nextPage();
    return;
  }
  if (props.hasMore && !props.loadingMore) {
    advancePending.value = true;
    emit("loadMore");
  }
}

watch(
  () => [props.data.length, props.loadingMore] as const,
  ([, loading]) => {
    if (!advancePending.value || loading) return;
    advancePending.value = false;
    if (table.getCanNextPage()) table.nextPage();
  },
);

watch(
  () => [table.getState().pagination.pageIndex, table.getPageCount(), props.hasMore] as const,
  ([index, count, more]) => {
    if (more && !props.loadingMore && index >= count - 1) emit("loadMore");
  },
);
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3">
    <DataTableToolbar
      v-model:search="search"
      v-model:density="density"
      :table="table"
      :features="features"
      :facets="props.facets"
      :facet-counts="!props.serverFiltering"
      :filtered="filtered"
      :search-placeholder="props.searchPlaceholder"
      :export-scope="exportScope"
      :export-disabled="props.data.length === 0"
      :refreshable="props.refreshable"
      :refreshing="props.refreshing"
      @reset-filters="controller.resetFilters"
      @reset-layout="controller.resetLayout"
      @export="exportAs"
      @refresh="emit('refresh')"
    >
      <slot name="toolbar" />
    </DataTableToolbar>

    <DataTableBulkBar
      v-if="features.selection"
      :count="selectedRows.length"
      :exportable="features.export"
      @clear="table.resetRowSelection()"
      @export="exportAs('csv', true)"
    >
      <slot name="bulk-actions" :rows="selectedRows" :clear="() => table.resetRowSelection()" />
    </DataTableBulkBar>

    <div
      class="overflow-hidden rounded-lg border [&_[data-slot=table-container]]:max-h-(--table-max-h)"
      :style="{ '--table-max-h': props.height }"
    >
      <Table>
        <TableHeader class="sticky top-0 z-[3]">
          <TableRow
            v-for="group in table.getHeaderGroups()"
            :key="group.id"
            class="hover:bg-transparent"
          >
            <DataTableHeaderCell
              v-for="header in group.headers"
              :key="header.id"
              :header="header"
              :order="columnOrder"
              :reorder="features.reorder"
              :grouping="groupingState"
              @move="controller.move"
              @group="controller.toggleGroup"
              @expand-all="controller.setAllExpanded"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="showSkeleton">
            <TableRow v-for="index in 8" :key="`skeleton-${index}`" class="hover:bg-transparent">
              <TableCell v-for="column in visibleColumns" :key="column.id" :class="CELL[density]">
                <Skeleton class="h-4 w-full max-w-40" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else-if="rows.length > 0">
            <template v-for="row in rows" :key="row.id">
              <DataTableGroupRow
                v-if="row.getIsGrouped()"
                :row="row"
                :table="table"
                :colspan="visibleColumns.length"
                :density="density"
                :selection="features.selection"
              />
              <TableRow
                v-else
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                :tabindex="props.rowClickable ? 0 : undefined"
                :class="
                  cn(
                    'group/row',
                    props.rowClickable && 'cursor-pointer',
                    props.rowClass?.(row.original),
                  )
                "
                @click="onRowClick(row.original, $event)"
                @keydown.enter.self="props.rowClickable && emit('rowClick', row.original)"
              >
                <TableCell
                  v-for="(cell, index) in row.getVisibleCells()"
                  :key="cell.id"
                  :style="[pinningStyle(cell.column), index === 0 && nestedIndent(row.depth)]"
                  :class="
                    cn(
                      CELL[density],
                      cell.column.columnDef.meta?.align === 'right' && 'text-right',
                      cell.column.columnDef.meta?.align === 'center' && 'text-center',
                      cell.column.getIsPinned() && PINNED_CELL,
                      pinningEdge(cell.column),
                      cell.column.columnDef.meta?.cellClass,
                    )
                  "
                >
                  <slot
                    v-if="slots[`cell-${cell.column.id}`]"
                    :name="`cell-${cell.column.id}`"
                    :row="row.original"
                    :value="cell.getValue()"
                  />
                  <FlexRender
                    v-else
                    :render="cell.column.columnDef.cell"
                    :props="cell.getContext()"
                  />
                </TableCell>
              </TableRow>
            </template>
          </template>
          <TableRow v-else class="hover:bg-transparent">
            <TableCell :colspan="visibleColumns.length" class="h-40 text-center">
              <slot name="empty">
                <div class="text-muted-foreground flex flex-col items-center gap-2 text-sm">
                  <span>{{ filtered ? "No row matches the filters." : "Nothing here yet." }}</span>
                  <Button
                    v-if="filtered"
                    variant="outline"
                    size="xs"
                    @click="controller.resetFilters"
                    >Reset filters</Button
                  >
                </div>
              </slot>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <DataTablePagination
      v-if="features.pagination"
      :table="table"
      :selection="features.selection"
      :total="props.total"
      :has-more="props.hasMore"
      :loading-more="props.loadingMore"
      @next="next"
    />
  </div>
</template>
