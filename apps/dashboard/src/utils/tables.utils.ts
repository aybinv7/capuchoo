/**
 * Export table data to CSV
 */
export const exportToCSV = <T>(data: T[], filename: string = 'export.csv', columns?: string[]) => {
  if (!data.length) return

  const keys = columns || Object.keys(data[0] as object)
  const csv = [
    keys.join(','), // Header
    ...data.map((row) =>
      keys
        .map((key) => {
          const value = (row as any)[key]
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(','),
    ),
  ].join('\n')

  downloadFile(csv, filename, 'text/csv')
}

/**
 * Export table data to JSON
 */
export const exportToJSON = <T>(
  data: T[],
  filename: string = 'export.json',
  pretty: boolean = true,
) => {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  downloadFile(json, filename, 'application/json')
}

/**
 * Helper to download a file
 */
const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Get selected rows from table
 */
export const getSelectedRows = <T>(table: any): T[] => {
  return table.getFilteredSelectedRowModel().rows.map((row: any) => row.original)
}

/**
 * Format number as currency
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US',
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Format date
 */
export const formatDate = (
  date: Date | string,
  format: 'short' | 'long' | 'full' = 'short',
  locale: string = 'en-US',
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  const optionsMap: Record<'short' | 'long' | 'full', Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    full: {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  }

  const options = optionsMap[format]

  return new Intl.DateTimeFormat(locale, options).format(dateObj)
}

/**
 * Debounce function for search inputs
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Compare two objects for equality
 */
export const isEqual = (a: any, b: any): boolean => {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Get column stats (min, max, mean, median)
 */
export const getColumnStats = (values: number[]) => {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((acc, val) => acc + val, 0)
  const len = sorted.length
  const min = sorted[0]!
  const max = sorted[len - 1]!
  const median =
    len % 2 === 0 ? (sorted[len / 2 - 1]! + sorted[len / 2]!) / 2 : sorted[Math.floor(len / 2)]!

  return {
    min,
    max,
    mean: sum / len,
    median,
    sum,
    count: len,
  }
}

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Truncate text
 */
export const truncate = (text: string, length: number = 50): string => {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

/**
 * Pluralize text
 */
export const pluralize = (count: number, singular: string, plural?: string): string => {
  if (count === 1) return `${count} ${singular}`
  return `${count} ${plural || singular + 's'}`
}

/**
 * Save table state to localStorage
 */
export const saveTableState = (key: string, state: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch (error) {
    console.error('Failed to save table state:', error)
  }
}

/**
 * Load table state from localStorage
 */
export const loadTableState = (key: string): any | null => {
  try {
    const state = localStorage.getItem(key)
    return state ? JSON.parse(state) : null
  } catch (error) {
    console.error('Failed to load table state:', error)
    return null
  }
}

/**
 * Clear table state from localStorage
 */
export const clearTableState = (key: string) => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Failed to clear table state:', error)
  }
}

/**
 * Get unique values from array
 */
export const getUniqueValues = <T>(array: T[]): T[] => {
  return Array.from(new Set(array))
}

/**
 * Group array by key
 */
export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce(
    (result, item) => {
      const groupKey = String(item[key])
      if (!result[groupKey]) {
        result[groupKey] = []
      }
      result[groupKey].push(item)
      return result
    },
    {} as Record<string, T[]>,
  )
}

/**
 * Sort array by multiple keys
 */
export const sortBy = <T>(array: T[], keys: Array<{ key: keyof T; desc?: boolean }>): T[] => {
  return [...array].sort((a, b) => {
    for (const { key, desc } of keys) {
      const aVal = a[key]
      const bVal = b[key]

      if (aVal < bVal) return desc ? 1 : -1
      if (aVal > bVal) return desc ? -1 : 1
    }
    return 0
  })
}

/**
 * Calculate percentage
 */
export const percentage = (value: number, total: number): string => {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

/**
 * Format bytes to human readable
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Highlight search terms in text
 */
export const highlightText = (text: string, search: string): string => {
  if (!search) return text

  const regex = new RegExp(`(${search})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

/**
 * Custom filter functions for TanStack Table
 */
export const customFilterFns = {
  // Filter for date ranges
  dateRange: (row: any, columnId: string, filterValue: [Date, Date]) => {
    const date = new Date(row.getValue(columnId))
    const [start, end] = filterValue
    return date >= start && date <= end
  },

  // Filter for number ranges
  numberRange: (row: any, columnId: string, filterValue: [number, number]) => {
    const value = row.getValue(columnId) as number
    const [min, max] = filterValue
    return value >= min && value <= max
  },

  // Filter for arrays (contains any)
  arrayContains: (row: any, columnId: string, filterValue: any[]) => {
    const value = row.getValue(columnId) as any[]
    return filterValue.some((v) => value.includes(v))
  },

  // Filter for multiple select
  multiSelect: (row: any, columnId: string, filterValue: string[]) => {
    if (!filterValue.length) return true
    return filterValue.includes(row.getValue(columnId))
  },
}

/**
 * Custom sorting functions for TanStack Table
 */
export const customSortingFns = {
  // Sort by date
  date: (rowA: any, rowB: any, columnId: string) => {
    const dateA = new Date(rowA.getValue(columnId))
    const dateB = new Date(rowB.getValue(columnId))
    return dateA.getTime() - dateB.getTime()
  },

  // Case-insensitive text sort
  textCaseInsensitive: (rowA: any, rowB: any, columnId: string) => {
    const textA = (rowA.getValue(columnId) as string).toLowerCase()
    const textB = (rowB.getValue(columnId) as string).toLowerCase()
    return textA.localeCompare(textB)
  },

  // Sort by custom priority
  priority: (rowA: any, rowB: any, columnId: string) => {
    const priority: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
    }
    const a = priority[rowA.getValue(columnId)] || 0
    const b = priority[rowB.getValue(columnId)] || 0
    return a - b
  },
}
