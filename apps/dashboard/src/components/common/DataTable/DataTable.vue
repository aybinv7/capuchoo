<template>
  <div class="space-y-4">
    <DataTableToolbar
      :table="table"
      :config="mergedConfig"
      :filters="filters"
      :density="state.density.value"
      :loading="props.loading"
      @toggle-density="state.toggleDensity"
      @reset-filters="state.resetFilters"
      @click:refresh="$emit('refresh')"
      @export="
        (format) =>
          $emit(
            'bulkActions:export',
            table.getFilteredSelectedRowModel().rows.map((r) => r.original),
            format,
          )
      "
    />

    <DataTableBulkEdit
      v-if="mergedConfig.features.bulkActions"
      :selected-count="table.getFilteredSelectedRowModel().rows.length"
      :enable-edit="true"
      :enable-delete="true"
      :enable-export="true"
      @click:clear-selection="table.resetRowSelection()"
      @click:bulk-edit="
        $emit(
          'bulkActions:edit',
          table.getFilteredSelectedRowModel().rows.map((r) => r.original),
        )
      "
      @click:bulk-delete="
        $emit(
          'bulkActions:delete',
          table.getFilteredSelectedRowModel().rows.map((r) => r.original),
        )
      "
      @click:bulk-export="
        $emit(
          'bulkActions:export',
          table.getFilteredSelectedRowModel().rows.map((r) => r.original),
        )
      "
    />

    <div class="rounded-md border relative">
      <div
        ref="tableContainerRef"
        :class="{
          'overflow-auto': true,
        }"
      >
        <Table>
          <!-- Header -->
          <DataTableDraggableHeader
            v-if="mergedConfig.features.columnOrdering"
            :table="table"
            :cell-padding="cellPadding"
            :table-state="mergedState"
          />
          <TableHeader v-else>
            <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <TableHead v-for="header in headerGroup.headers" :key="header.id">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </TableHead>
            </TableRow>
          </TableHeader>

          <!-- Body -->
          <TableBody>
            <template v-if="table.getRowModel().rows?.length">
              <TableRow
                v-for="(row, index) in table.getRowModel().rows"
                :key="row.id"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
                :class="{
                  'bg-muted/30': mergedConfig.features.zebra && index % 2 === 1,
                }"
                @click="$emit('row-click', row.original)"
              >
                <TableCell
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  :class="cellPadding"
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
    <DataTablePagination :table="table" :config="mergedConfig" />
  </div>
</template>

<script setup lang="ts" generic="TData, TValue">
import { FlexRender } from '@tanstack/vue-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { computed, ref, onMounted } from 'vue'
import { useDataTable } from './useDataTable'
import DataTableToolbar from './components/DataTableToolbar.vue'
import DataTablePagination from './components/DataTablePagination.vue'
import DataTableDraggableHeader from './components/DataTableDraggableHeader.vue'
import DataTableBulkEdit from './components/DataTableBulkEdit.vue'
import type { DataTableProps } from './types'

const props = defineProps<DataTableProps<TData, TValue>>()
const emit = defineEmits<{
  (e: 'update:selection', value: TData[]): void
  (e: 'bulkActions:edit', value: TData[]): void
  (e: 'bulkActions:delete', value: TData[]): void
  (e: 'bulkActions:export', value: TData[], format?: string): void
  (e: 'row-click', value: TData): void
  (e: 'refresh'): void
}>()

const { table, config: mergedConfig, state } = useDataTable(props, emit)

const mergedState = computed(() => ({
  ...state,
  onColumnOrderChange: (order: any) => (state.columnOrder.value = order),
  features: mergedConfig.value.features,
}))

// Initialize column order if empty
onMounted(() => {
  if (props.columns.length > 0 && state.columnOrder.value.length === 0) {
    state.columnOrder.value = props.columns.map((col: any) => col.id || col.accessorKey) as string[]
  }
})

// Generate filters from faceted columns
const filters = computed(() => {
  // Only generate if we have data
  if (!props.data || props.data.length === 0) return []

  return table
    .getAllColumns()
    .filter((column) => column.columnDef.meta && (column.columnDef.meta as any).faceted)
    .map((column) => {
      const meta = column.columnDef.meta as any
      const title =
        meta.title ||
        (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)

      // Get faceted values - now resolved, not as getter
      const facets = column.getFacetedUniqueValues()
      const options = Array.from(facets.entries()).map(([value, count]) => ({
        label: `${value}`,
        value: value,
        count,
      }))

      return {
        columnId: column.id,
        title: title || column.id,
        options, // Resolved values, not a function
      }
    })
    .filter((f) => f.options.length > 0) // Only show filters with options
})

const cellPadding = computed(() => {
  const padding = {
    compact: 'px-2 py-1',
    normal: 'px-4 py-2',
    comfortable: 'px-6 py-3',
  }
  return padding[state.density.value]
})

const tableContainerRef = ref<HTMLElement | null>(null)
</script>
