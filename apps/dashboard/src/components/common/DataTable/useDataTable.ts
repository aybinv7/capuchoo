import {
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type ExpandedState,
  type GroupingState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type PaginationState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  useVueTable,
  type Table,
} from '@tanstack/vue-table'
import { ref, type Ref, computed } from 'vue'
import type { DataTableConfig, DataTableProps } from './types'

const defaultConfig: DataTableConfig = {
  features: {
    sorting: true,
    filtering: true,
    pagination: true,
    selection: true,
    grouping: true,
    columnOrdering: true,
    columnPinning: true,
    columnSizing: true,
    columnVisibility: true,
    density: true,
    virtualization: true,
    bulkActions: true,
    stickyHeader: true,
    zebra: true,
    resizableColumns: true,
    fuzzyFiltering: true,
  },
  defaults: {
    pageSize: 10,
    pageIndex: 0,
    pageSizeOptions: [10, 20, 30, 40, 50],
    density: 'normal',
  },
}

export function useDataTable<TData, TValue>(props: DataTableProps<TData, TValue>, emit: any) {
  // Merge config
  const config = computed(() => ({
    features: { ...defaultConfig.features, ...props.config?.features },
    defaults: { ...defaultConfig.defaults, ...props.config?.defaults },
  }))

  // State
  const sorting = ref<SortingState>([])
  const columnFilters = ref<ColumnFiltersState>([])
  const globalFilter = ref('')
  const columnVisibility = ref<VisibilityState>({})
  const rowSelection = ref<RowSelectionState>({})
  const pagination = ref<PaginationState>({
    pageIndex: config.value.defaults.pageIndex!,
    pageSize: config.value.defaults.pageSize!,
  })
  const grouping = ref<GroupingState>([])
  const expanded = ref<ExpandedState>({})
  const columnOrder = ref<ColumnOrderState>([])
  const columnPinning = ref<ColumnPinningState>({})
  const columnSizing = ref<ColumnSizingState>({})
  const density = ref<'compact' | 'normal' | 'comfortable'>(
    config.value.defaults.density ?? 'normal',
  )

  // Table instance configuration
  const table = useVueTable({
    get data() {
      return props.data
    },
    get columns() {
      return props.columns
    },
    state: {
      get sorting() {
        return sorting.value
      },
      get columnFilters() {
        return columnFilters.value
      },
      get globalFilter() {
        return globalFilter.value
      },
      get columnVisibility() {
        return columnVisibility.value
      },
      get rowSelection() {
        return rowSelection.value
      },
      get pagination() {
        return pagination.value
      },
      get grouping() {
        return grouping.value
      },
      get expanded() {
        return expanded.value
      },
      get columnOrder() {
        return columnOrder.value
      },
      get columnPinning() {
        return columnPinning.value
      },
      get columnSizing() {
        return columnSizing.value
      },
    },

    // Feature flags based on config
    enableSorting: config.value.features.sorting,
    enableFilters: config.value.features.filtering,
    enableRowSelection: config.value.features.selection,
    enableGrouping: config.value.features.grouping,
    enableColumnResizing:
      config.value.features.columnSizing || config.value.features.resizableColumns,
    enablePinning: config.value.features.columnPinning,
    enableMultiSort: true,

    // Handlers
    onSortingChange: (updater) =>
      typeof updater === 'function'
        ? (sorting.value = updater(sorting.value))
        : (sorting.value = updater),
    onColumnFiltersChange: (updater) =>
      typeof updater === 'function'
        ? (columnFilters.value = updater(columnFilters.value))
        : (columnFilters.value = updater),
    onGlobalFilterChange: (updater) =>
      typeof updater === 'function'
        ? (globalFilter.value = updater(globalFilter.value))
        : (globalFilter.value = updater),
    onColumnVisibilityChange: (updater) =>
      typeof updater === 'function'
        ? (columnVisibility.value = updater(columnVisibility.value))
        : (columnVisibility.value = updater),
    onRowSelectionChange: (updater) => {
      typeof updater === 'function'
        ? (rowSelection.value = updater(rowSelection.value))
        : (rowSelection.value = updater)
    },
    onPaginationChange: (updater) =>
      typeof updater === 'function'
        ? (pagination.value = updater(pagination.value))
        : (pagination.value = updater),
    onGroupingChange: (updater) =>
      typeof updater === 'function'
        ? (grouping.value = updater(grouping.value))
        : (grouping.value = updater),
    onExpandedChange: (updater) =>
      typeof updater === 'function'
        ? (expanded.value = updater(expanded.value))
        : (expanded.value = updater),
    onColumnOrderChange: (updater) =>
      typeof updater === 'function'
        ? (columnOrder.value = updater(columnOrder.value))
        : (columnOrder.value = updater),
    onColumnPinningChange: (updater) =>
      typeof updater === 'function'
        ? (columnPinning.value = updater(columnPinning.value))
        : (columnPinning.value = updater),
    onColumnSizingChange: (updater) =>
      typeof updater === 'function'
        ? (columnSizing.value = updater(columnSizing.value))
        : (columnSizing.value = updater),

    // Core implementations
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),

    // Custom
    globalFilterFn: (row, columnId, value) => {
      const cellValue = row.getValue(columnId)
      return String(cellValue).toLowerCase().includes(String(value).toLowerCase())
    },
  })

  // Helper functions
  const toggleDensity = () => {
    const densities: ('compact' | 'normal' | 'comfortable')[] = ['compact', 'normal', 'comfortable']
    const current = density.value
    const next = densities[(densities.indexOf(current) + 1) % densities.length] as
      | 'compact'
      | 'normal'
      | 'comfortable'
    density.value = next
  }

  const resetFilters = () => {
    globalFilter.value = ''
    columnFilters.value = []
  }

  const resetGrouping = () => {
    grouping.value = []
  }

  return {
    table,
    config,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
      pagination,
      grouping,
      expanded,
      columnOrder,
      columnPinning,
      columnSizing,
      density,
      toggleDensity,
      resetFilters,
      resetGrouping,
    },
  }
}
