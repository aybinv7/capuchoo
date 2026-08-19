import type { ColumnDef } from '@tanstack/vue-table'

export interface DataTableConfig {
  features: {
    sorting?: boolean
    filtering?: boolean
    pagination?: boolean
    selection?: boolean
    grouping?: boolean
    columnOrdering?: boolean
    columnPinning?: boolean
    columnSizing?: boolean
    columnVisibility?: boolean
    density?: boolean
    virtualization?: boolean
    bulkActions?: boolean
    stickyHeader?: boolean
    zebra?: boolean
    resizableColumns?: boolean
    fuzzyFiltering?: boolean
  }
  defaults?: {
    pageSize?: number
    pageIndex?: number
    pageSizeOptions?: number[]
    density?: 'compact' | 'normal' | 'comfortable'
  }
}

export interface DataTableFilterOption {
  label: string
  value: string | number | boolean
  icon?: any
  count?: number // For faceted filters
}

export interface DataTableFilterDef {
  columnId: string
  title: string
  options: DataTableFilterOption[] | ((data: any[]) => DataTableFilterOption[])
}

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  config?: DataTableConfig
  filters?: DataTableFilterDef[]
  searchPlaceholder?: string
  loading?: boolean
}
