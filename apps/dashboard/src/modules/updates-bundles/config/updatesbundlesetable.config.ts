// config/table.config.ts
/**
 * Global table configuration for updates and bundles
 * Enable/disable features based on your needs
 */
export const updatesBundlesTableConfig = {
  features: {
    // Core features
    sorting: true,
    filtering: true,
    pagination: true,
    selection: true,

    // Advanced features
    aggregating: false, // Disable for this table as it's not applicable
    columnOrdering: true,
    columnPinning: true,
    columnSizing: true,
    columnVisibility: true,
    columnFiltering: true,
    globalFiltering: true,
    fuzzyFiltering: true,
    columnFaceting: true,
    globalFaceting: true,
    grouping: true, // Disable grouping for this table
    expanding: true,
    rowPinning: true, // Disable row pinning for this table
    virtualization: true, // Enable for large datasets

    // UI features
    bulkActions: true,
    columnReorder: true,
    resizableColumns: true,
    stickyHeader: true,
    zebra: true, // Zebra striping
    density: true, // Table density (compact, normal, comfortable)
  },

  defaults: {
    pageSize: 10,
    pageSizeOptions: [10, 20, 30, 40, 50, 100, 200],
    density: 'normal' as 'compact' | 'normal' | 'comfortable',
    enableMultiSort: true,
    enableSortingRemoval: true,
    manualPagination: false, // Set to true for server-side pagination
    manualSorting: false, // Set to true for server-side sorting
    manualFiltering: false, // Set to true for server-side filtering
  },

  // Fuzzy filter config
  fuzzyFilter: {
    threshold: 0.3, // Lower = stricter matching
  },

  // Aggregation settings (not used in this table)
  aggregation: {
    enable: false,
    defaultFunction: 'sum', // Default aggregation function for numeric columns
    allowedFunctions: ['sum', 'min', 'max', 'mean', 'count', 'unique', 'uniqueCount', 'original'],
  },

  // Virtualization settings
  virtualization: {
    enabled: false,
    overscan: 10, // Number of items to render outside visible area
    itemSize: 56, // Default item size for estimation
  },
}

export type TableConfig = typeof updatesBundlesTableConfig
