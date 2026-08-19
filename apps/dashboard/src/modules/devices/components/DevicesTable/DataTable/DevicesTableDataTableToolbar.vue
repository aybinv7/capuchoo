<template>
  <div class="flex flex-col gap-4">
    <!-- Main toolbar -->
    <div
      class="flex flex-col md:flex-row md:flex-nowrap flex-wrap items-center justify-between gap-2 w-full"
    >
      <div class="flex flex-row flex-wrap md:flex-nowrap justify-start items-center gap-2 w-full">
        <div class="relative w-full min-w-xs max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search all columns..."
            :model-value="state.globalFilter.value"
            @update:model-value="state.onGlobalFilterChange($event)"
            class="pl-9 h-9"
          />
        </div>

        <!-- Faceted filters -->
        <DataTableFacetedFilter
          v-if="table.getColumn('platform')"
          :column="table.getColumn('platform')!"
          title="Platform"
          :options="platformOptions"
        />

        <DataTableFacetedFilter
          v-if="table.getColumn('channel')"
          :column="table.getColumn('channel')!"
          title="Channel"
          :options="channelOptions"
        />

        <Button
          v-if="isFiltered"
          variant="ghost"
          size="sm"
          class="h-8 px-2 lg:px-3"
          @click="state.resetFilters()"
        >
          Reset
          <X class="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div class="flex flex-row flex-wrap md:flex-nowrap justify-end items-center w-full gap-2">
        <Button variant="outline" size="sm" class="h-8" @click="state.toggleDensity()">
          <Columns class="h-4 w-4 mr-2" />
          {{ state.density.value }}
        </Button>

        <DataTableViewOptions :table="table" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="h-8">
              <Download class="h-4 w-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="exportCSV">
              <FileText class="mr-2 h-4 w-4" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem @click="exportJSON">
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

    <!-- Grouping indicator -->
    <div v-if="groupedColumns.length > 0" class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">Grouped by:</span>
      <div class="flex items-center gap-2">
        <Badge v-for="columnId in groupedColumns" :key="columnId" variant="secondary" class="gap-1">
          {{ table.getColumn(columnId)?.columnDef.id || columnId }}
          <button
            @click="table.getColumn(columnId)?.toggleGrouping()"
            class="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
          >
            <X class="h-3 w-3" />
          </button>
        </Badge>
      </div>
      <Button variant="ghost" size="sm" class="h-6 text-xs" @click="state.resetGrouping()">
        Clear all
      </Button>
    </div>

    <!-- Active filters summary -->
    <div v-if="isFiltered" class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted-foreground">Active filters:</span>

      <Badge v-if="state.globalFilter.value" variant="secondary" class="gap-2">
        Search: "{{ state.globalFilter.value }}"
        <button
          @click="state.onGlobalFilterChange('')"
          class="hover:bg-secondary-foreground/20 rounded-full p-0.5"
        >
          <X class="h-3 w-3" />
        </button>
      </Badge>

      <Badge
        v-for="filter in state.columnFilters.value"
        :key="filter.id"
        variant="secondary"
        class="gap-2"
      >
        {{ table.getColumn(filter.id)?.columnDef.id || filter.id }}:
        {{ Array.isArray(filter.value) ? filter.value.join(', ') : filter.value }}
        <button
          @click="table.getColumn(filter.id)?.setFilterValue(undefined)"
          class="hover:bg-secondary-foreground/20 rounded-full p-0.5"
        >
          <X class="h-3 w-3" />
        </button>
      </Badge>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import { computed } from 'vue'
import { Search, X, Columns, Download, FileText, FileJson } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import DataTableViewOptions from '@/components/common/DataTable/components/DataTableViewOptions.vue'
import DataTableFacetedFilter from '@/components/common/DataTable/components/DataTableFacetedFilter.vue'
import { exportToCSV, exportToJSON } from '@/utils/tables.utils'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  state: any
  isLoading?: boolean
}

const props = defineProps<DataTableToolbarProps<any>>()

defineEmits<{
  (e: 'click:refresh'): void
}>()

// Check if any filters are applied
const isFiltered = computed(() => {
  return props.state.columnFilters.value.length > 0 || props.state.globalFilter.value !== ''
})

// Get grouped columns
const groupedColumns = computed(() => {
  return props.table.getState().grouping
})

// Platform options
const platformOptions = computed(() => {
  const facets = props.table.getColumn('platform')?.getFacetedUniqueValues()
  return Array.from(facets?.entries() || []).map(([value, count]) => ({
    label: value.charAt(0).toUpperCase() + value.slice(1),
    value: value,
    count,
  }))
})

// Channel options
const channelOptions = computed(() => {
  const facets = props.table.getColumn('channel')?.getFacetedUniqueValues()
  return Array.from(facets?.entries() || []).map(([value, count]) => ({
    label: value,
    value: value,
    count,
  }))
})

// Export functions
const exportCSV = () => {
  const data = props.table.getFilteredRowModel().rows.map((row) => row.original)
  exportToCSV(data, 'devices.csv')
}

const exportJSON = () => {
  const data = props.table.getFilteredRowModel().rows.map((row) => row.original)
  exportToJSON(data, 'devices.json')
}
</script>
