import type {
  ColumnFiltersState,
  ExpandedState,
  GroupingState,
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  RowPinningState,
} from '@tanstack/vue-table'
import { ref, type Ref } from 'vue'
import { updatesBundlesTableConfig } from '../config/updatesbundlesetable.config'

export interface UpdatesBundlesDataTableConfig {
  enableSorting?: boolean
  enableFiltering?: boolean
  enableGrouping?: boolean
  enableAggregating?: boolean
  enablePinning?: boolean
  enableColumnOrdering?: boolean
  enableRowSelection?: boolean
  enablePagination?: boolean
  enableVirtualization?: boolean
}

export const useUpdatesBundlesDataTable = <TData>(config: UpdatesBundlesDataTableConfig = {}) => {
  // Core state
  const sorting = ref<SortingState>([{ id: 'created_at', desc: true }])
  const columnFilters = ref<ColumnFiltersState>([])
  const globalFilter = ref('')
  const columnVisibility = ref<VisibilityState>({})
  const rowSelection = ref<RowSelectionState>({})
  const pagination = ref<PaginationState>({
    pageIndex: 0,
    pageSize: updatesBundlesTableConfig.defaults.pageSize,
  })

  // Advanced state
  const grouping = ref<GroupingState>([])
  const expanded = ref<ExpandedState>({})
  const aggregation = ref<any>({})
  const columnOrder = ref<ColumnOrderState>([])
  const columnPinning = ref<ColumnPinningState>({})
  const columnSizing = ref<ColumnSizingState>({})
  const rowPinning = ref<RowPinningState>({
    top: [],
    bottom: [],
  })

  // Initialize column order with provided columns if available
  const initializeColumnOrder = (columns: any[]) => {
    if (columns && columns.length > 0 && columnOrder.value.length === 0) {
      columnOrder.value = columns.map((col: any) => col.id || col.accessorKey)
    }
  }

  // Merge with default config
  const features = {
    enableSorting: updatesBundlesTableConfig.features.sorting,
    enableFiltering: updatesBundlesTableConfig.features.filtering,
    enableGrouping: updatesBundlesTableConfig.features.grouping,
    enableAggregating: updatesBundlesTableConfig.features.aggregating,
    enablePinning: updatesBundlesTableConfig.features.columnPinning,
    enableColumnOrdering: updatesBundlesTableConfig.features.columnOrdering,
    enableRowSelection: updatesBundlesTableConfig.features.selection,
    enablePagination: updatesBundlesTableConfig.features.pagination,
    enableVirtualization: updatesBundlesTableConfig.features.virtualization,
    ...config,
  }

  // UI state
  const density = ref<'compact' | 'normal' | 'comfortable'>(
    updatesBundlesTableConfig.defaults.density,
  )
  const showColumnFilters = ref(false)
  const showGlobalFilter = ref(true)

  // Helper function for state updates
  const valueUpdater = <T>(updaterOrValue: T | ((old: T) => T), refValue: Ref<T>) => {
    refValue.value =
      typeof updaterOrValue === 'function'
        ? (updaterOrValue as (old: T) => T)(refValue.value)
        : updaterOrValue
  }

  // State change handlers
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    if (features.enableSorting) {
      valueUpdater(updater, sorting)
    }
  }

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    if (features.enableFiltering) {
      valueUpdater(updater, columnFilters)
    }
  }

  const onGlobalFilterChange: OnChangeFn<string> = (updater) => {
    if (features.enableFiltering) {
      valueUpdater(updater, globalFilter)
    }
  }

  const onColumnVisibilityChange: OnChangeFn<VisibilityState> = (updater) => {
    if (features.enableColumnOrdering) {
      valueUpdater(updater, columnVisibility)
    }
  }

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (updater) => {
    if (features.enableRowSelection) {
      valueUpdater(updater, rowSelection)
    }
  }

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    if (features.enablePagination) {
      valueUpdater(updater, pagination)
    }
  }

  const onGroupingChange: OnChangeFn<GroupingState> = (updater) => {
    if (features.enableGrouping) {
      valueUpdater(updater, grouping)
    }
  }

  const onExpandedChange: OnChangeFn<ExpandedState> = (updater) => {
    if (features.enableGrouping) {
      valueUpdater(updater, expanded)
    }
  }

  const onAggregationChange: OnChangeFn<any> = (updater) => {
    if (features.enableAggregating) {
      valueUpdater(updater, aggregation)
    }
  }

  // Additional aggregation functions
  const resetAggregation = () => {
    aggregation.value = {}
  }

  const onColumnOrderChange: OnChangeFn<ColumnOrderState> = (updater) => {
    if (features.enableColumnOrdering) {
      valueUpdater(updater, columnOrder)
    }
  }

  const onColumnPinningChange: OnChangeFn<ColumnPinningState> = (updater) => {
    if (features.enablePinning) {
      valueUpdater(updater, columnPinning)
    }
  }

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    valueUpdater(updater, columnSizing)
  }

  const onRowPinningChange: OnChangeFn<RowPinningState> = (updater) => {
    if (features.enablePinning) {
      valueUpdater(updater, rowPinning)
    }
  }

  // Actions
  const resetFilters = () => {
    columnFilters.value = []
    globalFilter.value = ''
  }

  const resetSorting = () => {
    sorting.value = [{ id: 'created_at', desc: true }]
  }

  const resetSelection = () => {
    rowSelection.value = {}
  }

  const resetGrouping = () => {
    grouping.value = []
    expanded.value = {}
  }

  const resetColumnOrder = () => {
    columnOrder.value = []
  }

  const resetColumnPinning = () => {
    columnPinning.value = { left: [], right: [] }
  }

  const resetColumnSizing = () => {
    columnSizing.value = {}
  }

  const resetAll = () => {
    resetFilters()
    resetSorting()
    resetSelection()
    resetGrouping()
    resetAggregation()
    resetColumnOrder()
    resetColumnPinning()
    resetColumnSizing()
  }

  const toggleDensity = () => {
    const densities: Array<'compact' | 'normal' | 'comfortable'> = [
      'compact',
      'normal',
      'comfortable',
    ]
    const currentIndex = densities.indexOf(density.value)
    density.value = densities[(currentIndex + 1) % densities.length] ?? 'normal'
  }

  return {
    // State
    sorting,
    columnFilters,
    globalFilter,
    columnVisibility,
    rowSelection,
    pagination,
    grouping,
    expanded,
    aggregation,
    columnOrder,
    columnPinning,
    columnSizing,
    rowPinning,
    density,
    showColumnFilters,
    showGlobalFilter,

    // Handlers
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onColumnVisibilityChange,
    onRowSelectionChange,
    onPaginationChange,
    onGroupingChange,
    onExpandedChange,
    onAggregationChange,
    onColumnOrderChange,
    onColumnPinningChange,
    onColumnSizingChange,
    onRowPinningChange,

    // Actions
    resetFilters,
    resetSorting,
    resetSelection,
    resetGrouping,
    resetAggregation,
    resetColumnOrder,
    resetColumnPinning,
    resetColumnSizing,
    resetAll,
    toggleDensity,

    // Config
    features,
  }
}
