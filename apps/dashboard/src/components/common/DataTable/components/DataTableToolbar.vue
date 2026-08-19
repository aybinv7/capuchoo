<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div class="flex flex-1 items-center space-x-2">
        <Input
          v-if="config?.features.filtering"
          placeholder="Filter..."
          :model-value="table.getState().globalFilter ?? ''"
          class="h-8 w-[150px] lg:w-[250px]"
          @input="table.setGlobalFilter($event.target.value)"
        />

        <div v-if="filters && filters.length > 0" class="flex items-center gap-2">
          <DataTableFacetedFilter
            v-for="filter in filters"
            :key="filter.columnId"
            :column="table.getColumn(filter.columnId)"
            :title="filter.title"
            :options="getFilterOptions(filter)"
          />
        </div>

        <Button v-if="isFiltered" variant="ghost" class="h-8 px-2 lg:px-3" @click="resetFilters">
          Reset
          <X class="ml-2 h-4 w-4" />
        </Button>
      </div>
      <div class="flex items-center space-x-2">
        <Button
          v-if="config?.features.density"
          variant="outline"
          size="sm"
          class="h-8"
          @click="toggleDensity"
        >
          <Columns class="h-4 w-4 mr-2" />
          {{ density }}
        </Button>

        <DataTableViewOptions v-if="config?.features.columnVisibility" :table="table" />

        <DropdownMenu v-if="config?.features.bulkActions">
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="h-8">
              <Download class="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="$emit('export', 'csv')">
              <FileText class="mr-2 h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem @click="$emit('export', 'excel')">
              <FileSpreadsheet class="mr-2 h-4 w-4" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem @click="$emit('export', 'json')">
              <FileJson class="mr-2 h-4 w-4" />
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          class="h-8 text-[#EAB308] border-[#EAB308]/20 hover:bg-[#EAB308]/10 hover:text-[#CA8A04] transition-colors"
          :disabled="isLoading"
          @click="$emit('click:refresh')"
        >
          <ILucideRefreshCw class="h-4 w-4 mr-2" :class="{ 'animate-spin': isLoading }" />
          Refresh
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="TData">
import { type Table } from '@tanstack/vue-table'
import { computed } from 'vue'
import { X, Columns, Download, FileText, FileSpreadsheet, FileJson } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DataTableConfig, DataTableFilterDef, DataTableFilterOption } from '../types'

const props = defineProps<{
  table: Table<TData>
  config?: DataTableConfig
  filters?: DataTableFilterDef[]
  density?: 'compact' | 'normal' | 'comfortable'
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleDensity'): void
  (e: 'resetFilters'): void
  (e: 'export', format: 'csv' | 'excel' | 'json'): void
  (e: 'click:refresh'): void
}>()

const isFiltered = computed(() => {
  return props.table.getState().columnFilters.length > 0 || !!props.table.getState().globalFilter
})

const getFilterOptions = (filter: DataTableFilterDef): DataTableFilterOption[] => {
  // Handle both function-based and direct array options
  if (typeof filter.options === 'function') {
    const data = props.table.getPreFilteredRowModel().rows.map((row) => row.original)
    return filter.options(data)
  }
  return filter.options as DataTableFilterOption[]
}

const toggleDensity = () => {
  emit('toggleDensity')
}

const resetFilters = () => {
  props.table.resetColumnFilters()
  props.table.setGlobalFilter('')
  emit('resetFilters')
}
</script>
