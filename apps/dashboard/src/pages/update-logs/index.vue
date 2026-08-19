<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import { getLocalTimeZone, today } from '@internationalized/date'
import { Loader2, ScrollText, BarChart3 } from 'lucide-vue-next'
import { useUpdateLogsQuery } from '@/modules/update-logs/composables/useUpdateLogsQuery'
import type { UpdateLog } from '@/modules/update-logs/types/update-logs.types'
import UpdateLogsFilters from '@/modules/update-logs/components/UpdateLogsFilters.vue'
import UpdateLogsList from '@/modules/update-logs/components/UpdateLogsList.vue'

definePage({
  meta: {
    title: 'Update Logs - CapGO Updater',
    description: 'Activity feed for update events',
    category: 'update-logs',
  },
})

// Filter state
const searchQuery = ref('')
const selectedActions = ref<string[]>([])
const selectedPlatforms = ref<string[]>([])
const limit = ref(100)
const isLoadingMore = ref(false)

// Date range using CalendarDate for compatibility with RangeCalendar
const tz = getLocalTimeZone()
const dateRange = ref<DateRange>({
  start: today(tz).subtract({ days: 7 }),
  end: today(tz),
})

// Query
const { data: logs, isLoading, isFetching, refetch } = useUpdateLogsQuery({ limit: limit.value })

// Filter logs client-side
const filteredLogs = computed(() => {
  if (!logs.value) return []

  return logs.value.filter((log: UpdateLog) => {
    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      const matches =
        log.device_id.toLowerCase().includes(query) ||
        log.ip?.toLowerCase().includes(query) ||
        log.new_version?.toLowerCase().includes(query) ||
        log.current_version?.toLowerCase().includes(query)
      if (!matches) return false
    }

    // Action filter
    if (selectedActions.value.length > 0 && !selectedActions.value.includes(log.action)) {
      return false
    }

    // Platform filter
    if (selectedPlatforms.value.length > 0 && !selectedPlatforms.value.includes(log.platform)) {
      return false
    }

    // Date range filter
    if (dateRange.value.start) {
      const logDate = new Date(log.timestamp)
      const startDate = new Date(
        dateRange.value.start.year,
        dateRange.value.start.month - 1,
        dateRange.value.start.day,
      )
      if (logDate < startDate) return false

      if (dateRange.value.end) {
        const endDate = new Date(
          dateRange.value.end.year,
          dateRange.value.end.month - 1,
          dateRange.value.end.day,
          23,
          59,
          59,
          999,
        )
        if (logDate > endDate) return false
      }
    }

    return true
  })
})

// Stats from filtered logs
const stats = computed(() => {
  const all = filteredLogs.value
  return {
    total: all.length,
    downloads: all.filter((l) => l.action === 'download').length,
    installs: all.filter((l) => l.action === 'install').length,
    failures: all.filter((l) => l.action.includes('fail')).length,
  }
})

// Handlers
const clearFilters = () => {
  searchQuery.value = ''
  selectedActions.value = []
  selectedPlatforms.value = []
  dateRange.value = {
    start: today(tz).subtract({ days: 7 }),
    end: today(tz),
  }
}

const loadMore = async () => {
  isLoadingMore.value = true
  limit.value += 100
  await refetch()
  isLoadingMore.value = false
}

const handleExport = () => {
  // Export filtered logs as JSON
  const dataStr = JSON.stringify(filteredLogs.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `update-logs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const handleSelectLog = (log: UpdateLog) => {
  // TODO: Open detail drawer/modal
  console.log('Selected log:', log)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-bold tracking-tight">Update Logs</h1>
      <p class="text-muted-foreground">Monitor all update activity across your devices</p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent class="pt-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Total Events</p>
              <p class="text-2xl font-bold">{{ stats.total.toLocaleString() }}</p>
            </div>
            <BarChart3 class="h-8 w-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Downloads</p>
              <p class="text-2xl font-bold text-blue-500">{{ stats.downloads.toLocaleString() }}</p>
            </div>
            <div class="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <span class="text-blue-500 text-lg">↓</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Installs</p>
              <p class="text-2xl font-bold text-green-500">{{ stats.installs.toLocaleString() }}</p>
            </div>
            <div class="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <span class="text-green-500 text-lg">✓</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Failures</p>
              <p class="text-2xl font-bold text-red-500">{{ stats.failures.toLocaleString() }}</p>
            </div>
            <div class="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <span class="text-red-500 text-lg">✕</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Filters -->
    <UpdateLogsFilters
      v-model:search-query="searchQuery"
      v-model:selected-actions="selectedActions"
      v-model:selected-platforms="selectedPlatforms"
      v-model:date-range="dateRange"
      :is-loading="isFetching"
      @refresh="refetch"
      @clear="clearFilters"
      @export="handleExport"
    />

    <!-- Content -->
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="filteredLogs.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <ScrollText class="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 class="text-lg font-semibold">No logs found</h3>
      <p class="text-muted-foreground max-w-sm">
        {{
          searchQuery || selectedActions.length || selectedPlatforms.length
            ? 'Try adjusting your filters to see more results'
            : 'Logs will appear here when devices interact with updates'
        }}
      </p>
    </div>

    <UpdateLogsList
      v-else
      :logs="filteredLogs"
      :has-more="Boolean(logs && logs.length >= limit)"
      :is-loading-more="isLoadingMore"
      @load-more="loadMore"
      @select-log="handleSelectLog"
    />
  </div>
</template>
