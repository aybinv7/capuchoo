<template>
  <div class="space-y-4">
    <UpdatesBundlesTableDataTableToolbar
      :table="table"
      :state="tableState"
      :is-loading="isLoading"
      @click:refresh="$emit('refresh')"
    />

    <div
      :class="[
        'table-container overflow-x-scroll relative rounded-md border w-full',
        sidebarExpanded
          ? 'md:w-[calc(100vw-288px)] lg:w-[calc(100vw-312px)]'
          : 'md:w-[calc(100vw-40px)] lg:w-[calc(100vw-64px)]',
      ]"
    >
      <div class="overflow-x-auto overflow-y-hidden max-w-full" ref="tableContainerRef">
        <Table :class="densityClasses" class="min-w-full">
          <UpdatesBundlesTableDataTableDraggableHeader
            v-if="tableState.features.enableColumnOrdering"
            :table="table"
            :cellPadding="cellPadding"
            :tableState="tableState"
          />
          <TableHeader v-else class="bg-background">
            <TableRow
              v-for="headerGroup in table.getHeaderGroups()"
              :key="headerGroup.id"
              class="border-b bg-muted/50 sticky top-0 z-10"
            >
              <TableHead
                class="relative"
                v-for="header in headerGroup.headers"
                :key="header.id"
                :class="[
                  cellPadding,
                  header.column.getIsPinned() ? 'sticky z-20 bg-background' : '',
                  header.column.getIsPinned() === 'left' ? 'left-0' : '',
                  header.column.getIsPinned() === 'right' ? 'right-0' : '',
                ]"
                :style="{
                  width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined,
                  minWidth: header.column.columnDef.minSize
                    ? `${header.column.columnDef.minSize}px`
                    : undefined,
                  maxWidth: header.column.columnDef.maxSize
                    ? `${header.column.columnDef.maxSize}px`
                    : undefined,
                  ...(header.column.getIsPinned() === 'left' && {
                    left: `${table
                      .getLeftVisibleLeafColumns()
                      .reduce(
                        (sum, col, index) =>
                          index <
                          table
                            .getLeftVisibleLeafColumns()
                            .findIndex((c) => c.id === header.column.id)
                            ? sum + (table.getColumn(col.id)?.getSize() || 0)
                            : sum,
                        0,
                      )}px`,
                    zIndex: 20,
                  }),
                  ...(header.column.getIsPinned() === 'right' && {
                    right: `${table
                      .getRightVisibleLeafColumns()
                      .reduce(
                        (sum, col, index) =>
                          index >
                          table
                            .getRightVisibleLeafColumns()
                            .findIndex((c) => c.id === header.column.id)
                            ? sum + (table.getColumn(col.id)?.getSize() || 0)
                            : sum,
                        0,
                      )}px`,
                    zIndex: 20,
                  }),
                }"
              >
                <!-- Resizer -->
                <div
                  v-if="header.column.getCanResize()"
                  @mousedown="header.getResizeHandler()?.($event)"
                  @touchstart="header.getResizeHandler()?.($event)"
                  class="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-border hover:bg-primary transition-colors z-30 flex items-center justify-center"
                  :class="{
                    'bg-primary w-2': header.column.getIsResizing(),
                  }"
                >
                  <ILucideCar />
                </div>

                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            <!-- Pinned Top Rows -->
            <template v-if="table.getTopRows().length > 0">
              <TableRow
                v-for="row in table.getTopRows()"
                :key="row.id"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                class="bg-muted/30 border-b-2 border-primary/20"
                @click="handleRowClick(row)"
              >
                <TableCell
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  :class="[
                    cellPadding,
                    cell.column.getIsPinned() ? 'sticky z-10' : '',
                    cell.column.getIsPinned() === 'left' ? 'left-0 bg-muted/30' : '',
                    cell.column.getIsPinned() === 'right' ? 'right-0 bg-muted/30' : '',
                  ]"
                  :style="{
                    width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                    minWidth: cell.column.columnDef.minSize
                      ? `${cell.column.columnDef.minSize}px`
                      : undefined,
                    maxWidth: cell.column.columnDef.maxSize
                      ? `${cell.column.columnDef.maxSize}px`
                      : undefined,
                    ...(cell.column.getIsPinned() === 'left' && {
                      left: `${table
                        .getLeftVisibleLeafColumns()
                        .reduce(
                          (sum, col, index) =>
                            index <
                            table
                              .getLeftVisibleLeafColumns()
                              .findIndex((c) => c.id === cell.column.id)
                              ? sum + (table.getColumn(col.id)?.getSize() || 0)
                              : sum,
                          0,
                        )}px`,
                      zIndex: 10,
                    }),
                    ...(cell.column.getIsPinned() === 'right' && {
                      right: `${table
                        .getRightVisibleLeafColumns()
                        .reduce(
                          (sum, col, index) =>
                            index >
                            table
                              .getRightVisibleLeafColumns()
                              .findIndex((c) => c.id === cell.column.id)
                              ? sum + (table.getColumn(col.id)?.getSize() || 0)
                              : sum,
                          0,
                        )}px`,
                      zIndex: 10,
                    }),
                  }"
                >
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </template>
            <!-- Virtualized Center Rows (only if virtualization is enabled) -->
            <template
              v-if="
                tableState.features.enableVirtualization &&
                virtualizer &&
                getVirtualItems.value &&
                getVirtualItems.value.length > 0
              "
            >
              <div
                :style="{
                  height: `${getTotalSize.value}px`,
                  width: '100%',
                  position: 'relative',
                }"
              >
                <template v-for="virtualRow in getVirtualItems.value" :key="virtualRow.key">
                  <TableRow
                    :data-row-index="virtualRow.index"
                    :style="{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }"
                    :data-state="
                      table.getRowModel().rows[virtualRow.index]?.getIsSelected()
                        ? 'selected'
                        : undefined
                    "
                    :class="{
                      'cursor-pointer hover:bg-muted/50': true,
                      'font-semibold bg-muted/20': table
                        .getRowModel()
                        .rows[virtualRow.index]?.getIsGrouped(),
                    }"
                    @click="handleRowClick(table.getRowModel().rows[virtualRow.index])"
                  >
                    <TableCell
                      v-for="cell in table
                        .getRowModel()
                        .rows[virtualRow.index]?.getVisibleCells() || []"
                      :key="cell.id"
                      :class="[
                        cellPadding,
                        cell.column.getIsPinned() ? 'sticky z-10' : '',
                        cell.column.getIsPinned() === 'left' ? 'left-0 bg-background' : '',
                        cell.column.getIsPinned() === 'right' ? 'right-0 bg-background' : '',
                      ]"
                      :style="{
                        width:
                          cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                        minWidth: cell.column.columnDef.minSize
                          ? `${cell.column.columnDef.minSize}px`
                          : undefined,
                        maxWidth: cell.column.columnDef.maxSize
                          ? `${cell.column.columnDef.maxSize}px`
                          : undefined,
                        ...(cell.column.getIsPinned() === 'left' && {
                          left: `${table
                            .getLeftVisibleLeafColumns()
                            .reduce(
                              (sum, col, index) =>
                                index <
                                table
                                  .getLeftVisibleLeafColumns()
                                  .findIndex((c) => c.id === cell.column.id)
                                  ? sum + (table.getColumn(col.id)?.getSize() || 0)
                                  : sum,
                              0,
                            )}px`,
                          zIndex: 10,
                        }),
                        ...(cell.column.getIsPinned() === 'right' && {
                          right: `${table
                            .getRightVisibleLeafColumns()
                            .reduce(
                              (sum, col, index) =>
                                index >
                                table
                                  .getRightVisibleLeafColumns()
                                  .findIndex((c) => c.id === cell.column.id)
                                  ? sum + (table.getColumn(col.id)?.getSize() || 0)
                                  : sum,
                              0,
                            )}px`,
                          zIndex: 10,
                        }),
                      }"
                    >
                      <div v-if="cell.getIsGrouped()" class="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-6 w-6 p-0"
                          @click.stop="table.getRowModel().rows[virtualRow.index]?.toggleExpanded()"
                        >
                          <ILucideChevronRight
                            class="h-4 w-4 transition-transform"
                            :class="{
                              'rotate-90': table
                                .getRowModel()
                                .rows[virtualRow.index]?.getIsExpanded(),
                            }"
                          />
                        </Button>
                        <FlexRender
                          :render="cell.column.columnDef.cell"
                          :props="cell.getContext()"
                        />
                      </div>

                      <div v-else-if="cell.getIsAggregated()">
                        <FlexRender
                          :render="
                            cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell
                          "
                          :props="cell.getContext()"
                        />
                        <div
                          v-if="tableState.features.enableAggregating"
                          class="text-xs text-muted-foreground hidden"
                        >
                          [AGG: {{ cell.getValue() }}]
                        </div>
                      </div>

                      <div v-else-if="cell.getIsPlaceholder()" />

                      <FlexRender
                        v-else
                        :render="cell.column.columnDef.cell"
                        :props="cell.getContext()"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-if="
                      table.getRowModel().rows[virtualRow.index]?.getIsExpanded() &&
                      !table.getRowModel().rows[virtualRow.index]?.getIsGrouped()
                    "
                    class="bg-muted/20"
                    :style="{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: 'auto',
                      transform: `translateY(${virtualRow.start + virtualRow.size + 10}px)`,
                    }"
                  >
                    <TableCell
                      :colspan="
                        table.getRowModel().rows[virtualRow.index]?.getAllCells().length || 0
                      "
                      :class="cellPadding"
                    >
                      <div class="p-4 space-y-2">
                        <h4 class="font-semibold">Details</h4>
                        <pre class="text-xs bg-background p-2 rounded">{{
                          JSON.stringify(
                            table.getRowModel().rows[virtualRow.index]?.original,
                            null,
                            2,
                          )
                        }}</pre>
                      </div>
                    </TableCell>
                  </TableRow>
                </template>
              </div>
            </template>

            <!-- Non-virtualized Center Rows (fallback when virtualization is disabled or not working) -->
            <template v-else-if="table.getCenterRows().length > 0">
              <template v-for="row in table.getCenterRows()" :key="row.id">
                <TableRow
                  :data-state="row.getIsSelected() ? 'selected' : undefined"
                  :class="{
                    'cursor-pointer hover:bg-muted/50': true,
                    'font-semibold bg-muted/20': row.getIsGrouped(),
                  }"
                  @click="handleRowClick(row)"
                >
                  <TableCell
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                    :class="[
                      cellPadding,
                      cell.column.getIsPinned() ? 'sticky z-10' : '',
                      cell.column.getIsPinned() === 'left' ? 'left-0 bg-background' : '',
                      cell.column.getIsPinned() === 'right' ? 'right-0 bg-background' : '',
                    ]"
                    :style="{
                      width:
                        cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                      minWidth: cell.column.columnDef.minSize
                        ? `${cell.column.columnDef.minSize}px`
                        : undefined,
                      maxWidth: cell.column.columnDef.maxSize
                        ? `${cell.column.columnDef.maxSize}px`
                        : undefined,
                      ...(cell.column.getIsPinned() === 'left' && {
                        left: `${table
                          .getLeftVisibleLeafColumns()
                          .reduce(
                            (sum, col, index) =>
                              index <
                              table
                                .getLeftVisibleLeafColumns()
                                .findIndex((c) => c.id === cell.column.id)
                                ? sum + (table.getColumn(col.id)?.getSize() || 0)
                                : sum,
                            0,
                          )}px`,
                        zIndex: 10,
                      }),
                      ...(cell.column.getIsPinned() === 'right' && {
                        right: `${table
                          .getRightVisibleLeafColumns()
                          .reduce(
                            (sum, col, index) =>
                              index >
                              table
                                .getRightVisibleLeafColumns()
                                .findIndex((c) => c.id === cell.column.id)
                                ? sum + (table.getColumn(col.id)?.getSize() || 0)
                                : sum,
                            0,
                          )}px`,
                        zIndex: 10,
                      }),
                    }"
                  >
                    <div v-if="cell.getIsGrouped()" class="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 w-6 p-0"
                        @click.stop="row.toggleExpanded()"
                      >
                        <ILucideChevronRight
                          class="h-4 w-4 transition-transform"
                          :class="{ 'rotate-90': row.getIsExpanded() }"
                        />
                      </Button>
                      <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                    </div>

                    <div v-else-if="cell.getIsAggregated()">
                      <FlexRender
                        :render="cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell"
                        :props="cell.getContext()"
                      />
                    </div>

                    <div v-else-if="cell.getIsPlaceholder()" />

                    <FlexRender
                      v-else
                      :render="cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </TableCell>
                </TableRow>

                <!-- Expanded Row Content -->
                <TableRow
                  v-if="row.getIsExpanded() && !row.getIsGrouped()"
                  class="bg-muted/20"
                  :style="{ height: 'auto' }"
                >
                  <TableCell :colspan="row.getAllCells().length" :class="cellPadding">
                    <div class="p-4 space-y-2">
                      <h4 class="font-semibold">Details</h4>
                      <pre class="text-xs bg-background p-2 rounded">{{
                        JSON.stringify(row.original, null, 2)
                      }}</pre>
                    </div>
                  </TableCell>
                </TableRow>
              </template>
            </template>

            <!-- Pinned Bottom Rows -->
            <template v-if="table.getBottomRows().length > 0">
              <TableRow
                v-for="row in table.getBottomRows()"
                :key="row.id"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                class="bg-muted/30 border-t-2 border-primary/20"
                @click="handleRowClick(row)"
              >
                <TableCell
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  :class="[
                    cellPadding,
                    cell.column.getIsPinned() ? 'sticky z-10' : '',
                    cell.column.getIsPinned() === 'left' ? 'left-0 bg-muted/30' : '',
                    cell.column.getIsPinned() === 'right' ? 'right-0 bg-muted/30' : '',
                  ]"
                  :style="{
                    width: cell.column.getSize() !== 150 ? `${cell.column.getSize()}px` : undefined,
                    minWidth: cell.column.columnDef.minSize
                      ? `${cell.column.columnDef.minSize}px`
                      : undefined,
                    maxWidth: cell.column.columnDef.maxSize
                      ? `${cell.column.columnDef.maxSize}px`
                      : undefined,
                    ...(cell.column.getIsPinned() === 'left' && {
                      left: `${table
                        .getLeftVisibleLeafColumns()
                        .reduce(
                          (sum, col, index) =>
                            index <
                            table
                              .getLeftVisibleLeafColumns()
                              .findIndex((c) => c.id === cell.column.id)
                              ? sum + (table.getColumn(col.id)?.getSize() || 0)
                              : sum,
                          0,
                        )}px`,
                      zIndex: 10,
                    }),
                    ...(cell.column.getIsPinned() === 'right' && {
                      right: `${table
                        .getRightVisibleLeafColumns()
                        .reduce(
                          (sum, col, index) =>
                            index >
                            table
                              .getRightVisibleLeafColumns()
                              .findIndex((c) => c.id === cell.column.id)
                              ? sum + (table.getColumn(col.id)?.getSize() || 0)
                              : sum,
                          0,
                        )}px`,
                      zIndex: 10,
                    }),
                  }"
                >
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </template>

            <!-- Empty State -->
            <template v-if="table.getCenterRows().length === 0">
              <TableRow>
                <TableCell :colspan="columns.length" class="h-64 text-center">
                  <div class="flex flex-col items-center justify-center py-12">
                    <ILucideInbox class="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 class="text-lg font-semibold mb-1">No results found</h3>
                    <p class="text-sm text-muted-foreground mb-4">
                      Try adjusting your search or filters
                    </p>
                    <Button variant="outline" size="sm" @click="tableState.resetAll">
                      <ILucideRefreshCw class="mr-2 h-4 w-4" />
                      Reset filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>

          <!-- Aggregation Footer for total aggregations -->
          <TableFooter v-if="tableState.features.enableAggregating">
            <TableRow class="border-t-2 border-primary/20 bg-muted/30">
              <TableCell
                v-for="footer in table.getFooterGroups()[0]?.headers || []"
                :key="footer.id"
                :class="cellPadding"
              >
                <FlexRender :render="footer.column.columnDef.footer" :props="footer.getContext()" />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>

    <!-- Pagination -->
    <UpdatesBundlesTableDataTablePagination :table="table" />
  </div>
</template>

<script setup lang="ts" generic="TData, TValue">
import type { ColumnDef } from '@tanstack/vue-table'
import {
  FlexRender,
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
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useUpdatesBundlesDataTable } from '@/modules/updates-bundles/composables/useUpdatesBundlesDataTable'

const rankItem = (rowValue: any, value: string) => {
  const passed = String(rowValue).toLowerCase().includes(value.toLowerCase())
  return { passed: passed, score: passed ? 1 : 0 }
}

interface DataTableProps {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  meta?: Record<string, any>
  isLoading?: boolean
}

const props = defineProps<DataTableProps>()

const emit = defineEmits<{
  (e: 'selectionChange', selection: TData[]): void
  (e: 'rowClick', row: TData): void
  (e: 'refresh'): void
}>()

const tableState = useUpdatesBundlesDataTable()
const sidebarExpanded = ref(true)

onMounted(() => {
  const sidebar = document.querySelector('[data-state]')
  if (sidebar) {
    sidebarExpanded.value = sidebar.getAttribute('data-state') === 'expanded'

    const observer = new MutationObserver(() => {
      sidebarExpanded.value = sidebar.getAttribute('data-state') === 'expanded'
    })
    observer.observe(sidebar, { attributes: true, attributeFilter: ['data-state'] })
  }

  if (props.columns && props.columns.length > 0 && tableState.columnOrder.value.length === 0) {
    tableState.columnOrder.value = props.columns.map((col: any) => col.id || col.accessorKey)
  }
})

const fuzzyFilter = (row: any, columnId: string, value: string, addMeta: any) => {
  try {
    const itemRank = rankItem(row.getValue(columnId), value)
    addMeta({ itemRank })
    return itemRank.passed
  } catch {
    return String(row.getValue(columnId)).toLowerCase().includes(value.toLowerCase())
  }
}

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  get meta() {
    return props.meta
  },

  // Core
  getCoreRowModel: getCoreRowModel(),

  // Sorting
  getSortedRowModel: getSortedRowModel(),
  onSortingChange: tableState.onSortingChange,
  enableSortingRemoval: true,
  enableMultiSort: true,

  // Filtering
  getFilteredRowModel: getFilteredRowModel(),
  onColumnFiltersChange: tableState.onColumnFiltersChange,
  onGlobalFilterChange: tableState.onGlobalFilterChange,
  globalFilterFn: fuzzyFilter,

  // Faceting (for filter options)
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getFacetedMinMaxValues: getFacetedMinMaxValues(),

  // Pagination
  getPaginationRowModel: getPaginationRowModel(),
  onPaginationChange: tableState.onPaginationChange,

  // Grouping
  getGroupedRowModel: getGroupedRowModel(),
  onGroupingChange: tableState.onGroupingChange,
  getExpandedRowModel: getExpandedRowModel(),
  onExpandedChange: tableState.onExpandedChange,

  // Column management
  onColumnVisibilityChange: tableState.onColumnVisibilityChange,
  onColumnOrderChange: tableState.onColumnOrderChange,
  onColumnPinningChange: tableState.onColumnPinningChange,
  onColumnSizingChange: tableState.onColumnSizingChange,
  enableColumnResizing: true,
  columnResizeMode: 'onChange',

  // Row features
  onRowSelectionChange: (updater) => {
    tableState.onRowSelectionChange(updater)
    const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
    emit('selectionChange', selectedRows)
  },
  onRowPinningChange: tableState.onRowPinningChange,

  // State
  state: {
    get sorting() {
      return tableState.sorting.value
    },
    get columnFilters() {
      return tableState.columnFilters.value
    },
    get globalFilter() {
      return tableState.globalFilter.value
    },
    get columnVisibility() {
      return tableState.columnVisibility.value
    },
    get rowSelection() {
      return tableState.rowSelection.value
    },
    get pagination() {
      return tableState.pagination.value
    },
    get grouping() {
      return tableState.grouping.value
    },
    get expanded() {
      return tableState.expanded.value
    },
    get columnOrder() {
      return tableState.columnOrder.value
    },
    get columnPinning() {
      return tableState.columnPinning.value
    },
    get columnSizing() {
      return tableState.columnSizing.value
    },
    get rowPinning() {
      return tableState.rowPinning.value
    },
  },

  // Filter functions
  filterFns: {
    fuzzy: fuzzyFilter,
  },
})

const densityClasses = computed(() => {
  const base = {
    compact: 'text-xs',
    normal: 'text-sm',
    comfortable: 'text-base',
  }
  return base[tableState.density.value]
})

const cellPadding = computed(() => {
  const padding = {
    compact: 'px-2 py-1',
    normal: 'px-4 py-2',
    comfortable: 'px-6 py-3',
  }
  return padding[tableState.density.value]
})

const tableContainerRef = ref<HTMLElement | null>(null)

const virtualizer = computed(() => {
  if (!tableState.features.enableVirtualization || !tableContainerRef.value) {
    return null
  }

  try {
    return useVirtualizer({
      count: table.getRowModel().rows.length,
      getScrollElement: () => tableContainerRef.value,
      estimateSize: () => 56,
    })
  } catch (error) {
    console.warn('Virtualization failed, falling back to regular rendering:', error)
    return null
  }
})

const getVirtualItems = computed(() => {
  if (virtualizer.value && typeof (virtualizer.value as any).getVirtualItems === 'function') {
    return (virtualizer.value as any).getVirtualItems() || []
  }
  return []
})

const getTotalSize = computed(() => {
  if (virtualizer.value && typeof (virtualizer.value as any).getTotalSize === 'function') {
    return (virtualizer.value as any).getTotalSize() || 0
  }
  return 0
})

const handleRowClick = (row: any) => {
  if (row && row.original) {
    emit('rowClick', row.original)
  }
}

defineExpose({
  table,
  state: tableState,
  getSelectedRows: () => table.getFilteredSelectedRowModel().rows.map((row) => row.original),
  clearSelection: () => {
    tableState.rowSelection.value = {}
  },
})
</script>

<style scoped>
/* .table-container {
  width: 100%;
  overflow-x: scroll;
}

.table-container :deep(table) {
  width: 100%;
  table-layout: auto;
}

.table-container :deep(thead th),
.table-container :deep(tbody td) {
  min-width: 0;
  word-wrap: break-word;
  white-space: nowrap;
}

.table-container :deep(table) {
  min-width: 100%;
} */
</style>
