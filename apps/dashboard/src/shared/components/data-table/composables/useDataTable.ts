import {
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnFiltersState,
  type ExpandedState,
  type FilterFn,
  type RowSelectionState,
  type SortingState,
  type Updater,
} from "@tanstack/vue-table";
import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import { facetFilter, globalSearch } from "../lib/filter-fns";
import { leafOriginals, sanitizeGrouping, toggleGrouping } from "../lib/grouping";
import { defaultPreferences, moveColumn, pruneToColumns, resolveOrder } from "../lib/preferences";
import type { AnyColumnDef, DataTableFeatures, Density } from "../types";
import { useTablePreferences } from "./useTablePreferences";

function apply<T>(updater: Updater<T>, current: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(current) : updater;
}

export function columnIdOf<T>(column: AnyColumnDef<T>): string {
  if (column.id) return column.id;
  if ("accessorKey" in column && column.accessorKey !== undefined)
    return String(column.accessorKey);
  return "";
}

export interface UseDataTableOptions<T> {
  data: MaybeRefOrGetter<readonly T[]>;
  columns: MaybeRefOrGetter<AnyColumnDef<T>[]>;
  getRowId: (row: T) => string;
  features: MaybeRefOrGetter<DataTableFeatures>;
  search: Ref<string>;
  filters: Ref<ColumnFiltersState>;
  /** The server applies search and facets; rows arrive already filtered. */
  serverFiltering: MaybeRefOrGetter<boolean>;
  /** More rows exist than are loaded, so a client-side sort would only order a slice. */
  incomplete: MaybeRefOrGetter<boolean>;
  tableId?: string;
  pageSize?: number;
}

/**
 * One TanStack table with the dashboard's conventions: search and facets as models the page can
 * send to the server, layout choices persisted per table, selection pruned to rows that still
 * exist, and the page reset whenever the result set changes meaning.
 */
export function useDataTable<T>(options: UseDataTableOptions<T>) {
  const prefs = useTablePreferences(options.tableId, options.pageSize);
  const sorting = ref<SortingState>([]);
  const rowSelection = ref<RowSelectionState>({});
  const pageIndex = ref(0);

  const columnIds = computed(() => toValue(options.columns).map(columnIdOf));
  const fixedIds = computed(
    () =>
      new Set(
        toValue(options.columns)
          .filter((column) => column.meta?.fixed)
          .map(columnIdOf),
      ),
  );
  const columnOrder = computed(() =>
    resolveOrder(columnIds.value, fixedIds.value, prefs.value.order),
  );
  const defaultVisibility = computed(() =>
    Object.fromEntries(
      toValue(options.columns)
        .filter((column) => column.meta?.defaultHidden)
        .map((column) => [columnIdOf(column), false]),
    ),
  );
  const visibility = computed(() => ({ ...defaultVisibility.value, ...prefs.value.visibility }));
  const sortable = computed(
    () => toValue(options.features).sorting && !toValue(options.incomplete),
  );
  const groupableIds = computed(
    () =>
      new Set(
        toValue(options.columns)
          .filter((column) => column.meta?.groupable && !column.meta?.fixed)
          .map(columnIdOf),
      ),
  );
  const groupingEnabled = computed(
    () => toValue(options.features).grouping && groupableIds.value.size > 0,
  );
  const groupable = computed(() => groupingEnabled.value && !toValue(options.incomplete));
  const grouping = computed(() =>
    groupable.value ? sanitizeGrouping(prefs.value.grouping ?? [], groupableIds.value) : [],
  );
  const expanded = ref<ExpandedState>(true);

  watch(
    columnIds,
    (ids) => {
      const pruned = pruneToColumns(prefs.value, ids);
      if (JSON.stringify(pruned) !== JSON.stringify(prefs.value)) prefs.value = pruned;
    },
    { immediate: true },
  );

  const table = useVueTable<T>({
    get data() {
      return toValue(options.data) as T[];
    },
    get columns() {
      return toValue(options.columns);
    },
    getRowId: (row) => options.getRowId(row),
    defaultColumn: { filterFn: facetFilter as FilterFn<T>, size: 160, minSize: 48 },
    globalFilterFn: globalSearch as FilterFn<T>,
    getColumnCanGlobalFilter: (column) =>
      Boolean(column.accessorFn) &&
      column.columnDef.enableGlobalFilter !== false &&
      !column.columnDef.meta?.fixed,
    state: {
      get sorting() {
        return sorting.value;
      },
      get columnFilters() {
        return options.filters.value;
      },
      get globalFilter() {
        return options.search.value;
      },
      get rowSelection() {
        return rowSelection.value;
      },
      get columnVisibility() {
        return visibility.value;
      },
      get columnOrder() {
        return columnOrder.value;
      },
      get columnPinning() {
        return prefs.value.pinning;
      },
      get grouping() {
        return grouping.value;
      },
      get expanded() {
        return expanded.value;
      },
      get pagination() {
        return { pageIndex: pageIndex.value, pageSize: prefs.value.pageSize };
      },
    },
    get manualFiltering() {
      return toValue(options.serverFiltering);
    },
    get enableSorting() {
      return sortable.value;
    },
    get enableRowSelection() {
      return toValue(options.features).selection;
    },
    get enableColumnPinning() {
      return toValue(options.features).pinning;
    },
    get enableGrouping() {
      return groupable.value;
    },
    groupedColumnMode: false,
    paginateExpandedRows: false,
    getRowCanExpand: (row) => row.getIsGrouped(),
    enableMultiSort: true,
    autoResetPageIndex: false,
    autoResetExpanded: false,
    onSortingChange: (updater) => {
      sorting.value = apply(updater, sorting.value);
    },
    onColumnFiltersChange: (updater) => {
      options.filters.value = apply(updater, options.filters.value);
    },
    onGlobalFilterChange: (updater) => {
      options.search.value = String(apply(updater, options.search.value) ?? "");
    },
    onRowSelectionChange: (updater) => {
      rowSelection.value = apply(updater, rowSelection.value);
    },
    onColumnVisibilityChange: (updater) => {
      prefs.value = { ...prefs.value, visibility: apply(updater, visibility.value) };
    },
    onColumnOrderChange: (updater) => {
      prefs.value = { ...prefs.value, order: apply(updater, columnOrder.value) };
    },
    onColumnPinningChange: (updater) => {
      prefs.value = { ...prefs.value, pinning: apply(updater, prefs.value.pinning) };
    },
    onGroupingChange: (updater) => {
      const next = sanitizeGrouping(apply(updater, grouping.value), groupableIds.value);
      prefs.value = { ...prefs.value, grouping: next };
    },
    onExpandedChange: (updater) => {
      expanded.value = apply(updater, expanded.value);
    },
    onPaginationChange: (updater) => {
      const next = apply(updater, { pageIndex: pageIndex.value, pageSize: prefs.value.pageSize });
      pageIndex.value = next.pageIndex;
      if (next.pageSize !== prefs.value.pageSize)
        prefs.value = { ...prefs.value, pageSize: next.pageSize };
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  watch(
    [
      () => options.search.value,
      () => options.filters.value,
      sorting,
      () => prefs.value.pageSize,
      () => grouping.value.join("|"),
    ],
    () => {
      pageIndex.value = 0;
    },
  );

  watch(
    () => grouping.value.join("|"),
    () => {
      expanded.value = true;
    },
  );

  watch(
    () => table.getPageCount(),
    (count) => {
      if (pageIndex.value > 0 && pageIndex.value >= count) pageIndex.value = Math.max(0, count - 1);
    },
  );

  watch(
    () => toValue(options.data),
    (rows) => {
      const selected = Object.keys(rowSelection.value);
      if (selected.length === 0) return;
      const present = new Set(rows.map(options.getRowId));
      const kept = selected.filter((id) => present.has(id));
      if (kept.length !== selected.length)
        rowSelection.value = Object.fromEntries(kept.map((id) => [id, true]));
    },
  );

  watch(sortable, (enabled) => {
    if (!enabled && sorting.value.length > 0) sorting.value = [];
  });

  const density = computed<Density>({
    get: () => prefs.value.density,
    set: (value) => {
      prefs.value = { ...prefs.value, density: value };
    },
  });

  const selectedRows = computed(() =>
    table.getFilteredSelectedRowModel().rows.map((row) => row.original),
  );

  const filtered = computed(
    () => options.search.value.trim().length > 0 || options.filters.value.length > 0,
  );

  function move(id: string, target: string) {
    table.setColumnOrder(moveColumn(columnOrder.value, id, target));
  }

  function resetLayout() {
    prefs.value = { ...defaultPreferences(prefs.value.pageSize), density: prefs.value.density };
  }

  function toggleGroup(id: string) {
    table.setGrouping(toggleGrouping(grouping.value, id));
  }

  function setAllExpanded(open: boolean) {
    expanded.value = open ? true : {};
  }

  /** Data rows in display order, through any grouping: what export and counts must use. */
  const leafRows = computed(() => leafOriginals(table.getSortedRowModel().rows));

  function resetFilters() {
    options.search.value = "";
    options.filters.value = [];
  }

  return {
    table,
    density,
    sortable,
    groupingEnabled,
    groupable,
    grouping,
    toggleGroup,
    setAllExpanded,
    leafRows,
    selectedRows,
    filtered,
    columnOrder,
    move,
    resetLayout,
    resetFilters,
  };
}

export type DataTableController<T> = ReturnType<typeof useDataTable<T>>;
