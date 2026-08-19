<template>
  <div class="space-y-4">
    <DevicesTableDataTableToolbar
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
          <!-- We reuse generic Draggable Header as it is flexible enough, or we could copy specific if needed.
               UpdatesBundles uses a specific one. To match strictness, I should perhaps use generic one if it works,
               or if drag and drop fails I might need specific. I'll use generic DraggableHeader for now as I updated it recently.
               Actually, I will check imports. -->
          <DataTableDraggableHeader
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
                  <Car />
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
            <template v-if="table.getRowModel().rows.length > 0">
              <TableRow
                v-for="row in table.getRowModel().rows"
                :key="row.id"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                class="hover:bg-muted/50"
                @click="handleRowClick(row)"
              >
                <TableCell
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  :class="[cellPadding]"
                >
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </template>
            <template v-else>
              <TableRow>
                <TableCell :colspan="columns.length" class="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>
    </div>

    <DataTablePagination :table="table" />
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
import { computed, ref, onMounted } from 'vue'
import { useDevicesDataTable } from '../../composables/useDevicesDataTable'
import DevicesTableDataTableToolbar from './DataTable/DevicesTableDataTableToolbar.vue'
import DataTableDraggableHeader from '@/components/common/DataTable/components/DataTableDraggableHeader.vue'
import DataTablePagination from '@/components/common/DataTable/components/DataTablePagination.vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Car } from 'lucide-vue-next'

const props = defineProps<{
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'selectionChange', selection: TData[]): void
  (e: 'rowClick', row: TData): void
  (e: 'refresh'): void
}>()

const tableState = useDevicesDataTable()
const sidebarExpanded = ref(true)

// Sidebar observer (copied from reference)
onMounted(() => {
  const sidebar = document.querySelector('[data-state]')
  if (sidebar) {
    sidebarExpanded.value = sidebar.getAttribute('data-state') === 'expanded'
    const observer = new MutationObserver(() => {
      sidebarExpanded.value = sidebar.getAttribute('data-state') === 'expanded'
    })
    observer.observe(sidebar, { attributes: true, attributeFilter: ['data-state'] })
  }

  // Init column order
  if (props.columns && props.columns.length > 0 && tableState.columnOrder.value.length === 0) {
    tableState.columnOrder.value = props.columns.map((col: any) => col.id || col.accessorKey)
  }
})

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  onSortingChange: tableState.onSortingChange,
  getFilteredRowModel: getFilteredRowModel(),
  onColumnFiltersChange: tableState.onColumnFiltersChange,
  onGlobalFilterChange: tableState.onGlobalFilterChange,
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  getFacetedMinMaxValues: getFacetedMinMaxValues(),
  getPaginationRowModel: getPaginationRowModel(),
  onPaginationChange: tableState.onPaginationChange,
  getGroupedRowModel: getGroupedRowModel(),
  onGroupingChange: tableState.onGroupingChange,
  getExpandedRowModel: getExpandedRowModel(),
  onExpandedChange: tableState.onExpandedChange,
  onColumnVisibilityChange: tableState.onColumnVisibilityChange,
  onColumnOrderChange: tableState.onColumnOrderChange,
  onColumnPinningChange: tableState.onColumnPinningChange,
  onColumnSizingChange: tableState.onColumnSizingChange,
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
  onRowSelectionChange: (updater) => {
    tableState.onRowSelectionChange(updater)
    // We need to wait for next tick or just map manually
    // Actually the reference implementation sets state then gets model
    // But since state is reactive ref passed to table, reading table.getSelectedRowModel should work if we wait or just rely on the updater updating the ref first.
    // The reference does: tableState.onRowSelectionChange(updater); const selected = ...
    setTimeout(() => {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
      emit('selectionChange', selectedRows)
    }, 0)
  },
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

const handleRowClick = (row: any) => {
  if (row && row.original) {
    emit('rowClick', row.original)
  }
}

defineExpose({
  table,
  state: tableState,
  clearSelection: () => {
    tableState.rowSelection.value = {}
  },
})
</script>

<style scoped>
.table-container {
  width: 100%;
  overflow-x: scroll;
}
</style>
