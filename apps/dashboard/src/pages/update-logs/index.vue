<script setup lang="ts">
import type { DateRange } from "reka-ui";
import { getLocalTimeZone, today } from "@internationalized/date";
import { Loader2, ScrollText, BarChart3 } from "lucide-vue-next";
import { useUpdateLogsQuery } from "@/modules/update-logs/composables/useUpdateLogsQuery";
import type { UpdateLog } from "@/modules/update-logs/types/update-logs.types";
import UpdateLogsFilters from "@/modules/update-logs/components/UpdateLogsFilters.vue";
import UpdateLogsList from "@/modules/update-logs/components/UpdateLogsList.vue";
import { classifyUpdateEvent, summariseEvents } from "@capuchoo/core";

definePage({
  meta: {
    title: "Update Logs - Capuchoo",
    description: "Activity feed for update events",
    category: "update-logs",
  },
});

// Filter state
const searchQuery = ref("");
/** Bundle identifier, or "" for every app. Applied server-side. */
const selectedAppId = ref("");
const selectedActions = ref<string[]>([]);
const selectedPlatforms = ref<string[]>([]);
const limit = ref(100);
const isLoadingMore = ref(false);

// Date range using CalendarDate for compatibility with RangeCalendar
const tz = getLocalTimeZone();
const dateRange = ref<DateRange>({
  start: today(tz).subtract({ days: 7 }),
  end: today(tz),
});

// Query. Refs, not `.value` - the composable reads them each time, so changing
// the app or pressing "load more" actually changes what is fetched.
const {
  data: logs,
  isLoading,
  isFetching,
  refetch,
} = useUpdateLogsQuery({ appId: selectedAppId, limit });

// Filter logs client-side
const filteredLogs = computed(() => {
  if (!logs.value) return [];

  return logs.value.filter((log: UpdateLog) => {
    // Search filter. `ip` was in here and is not a column on update_logs, so
    // that clause never matched; `action` and `error_message` are, and an error
    // is the thing you actually come to this page to find.
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const haystack = [
        log.device_id,
        log.action,
        log.new_version,
        log.current_version,
        log.error_message,
      ];
      if (!haystack.some((value) => value?.toLowerCase().includes(query))) return false;
    }

    // Action filter
    if (selectedActions.value.length > 0 && !selectedActions.value.includes(log.action)) {
      return false;
    }

    // Platform filter. `platform` is nullable on the row, and a row without one
    // cannot satisfy a platform filter - so it drops out rather than being
    // coerced to a platform it never reported.
    if (selectedPlatforms.value.length > 0) {
      if (!log.platform || !selectedPlatforms.value.includes(log.platform)) return false;
    }

    // Date range filter
    if (dateRange.value.start) {
      const logDate = new Date(log.created_at);
      const startDate = new Date(
        dateRange.value.start.year,
        dateRange.value.start.month - 1,
        dateRange.value.start.day,
      );
      if (logDate < startDate) return false;

      if (dateRange.value.end) {
        const endDate = new Date(
          dateRange.value.end.year,
          dateRange.value.end.month - 1,
          dateRange.value.end.day,
          23,
          59,
          59,
          999,
        );
        if (logDate > endDate) return false;
      }
    }

    return true;
  });
});

// Stats from filtered logs
/**
 * Counted through the shared classifier, not by matching names.
 *
 * These read `action === "download"` and `action === "install"`, exact matches
 * against names that are mostly not produced: the plugin's word for an applied
 * bundle is `set`, and `download` on its own is a progress tick. So "Installs"
 * showed 0 for every OTA update ever made, on a page whose whole purpose is to
 * show that they happened.
 *
 * `classifyUpdateEvent` is the same function the statistics page and the server
 * use, so the three cannot drift apart again.
 */
const stats = computed(() => {
  const summary = summariseEvents(filteredLogs.value.map((log) => log.action));

  return {
    total: summary.total,
    downloads: summary.downloading,
    installs: summary.delivered,
    failures: summary.failed,
  };
});

// Handlers
const clearFilters = () => {
  searchQuery.value = "";
  selectedAppId.value = "";
  selectedActions.value = [];
  selectedPlatforms.value = [];
  dateRange.value = {
    start: today(tz).subtract({ days: 7 }),
    end: today(tz),
  };
};

const loadMore = async () => {
  isLoadingMore.value = true;
  limit.value += 100;
  await refetch();
  isLoadingMore.value = false;
};

const handleExport = () => {
  // Export filtered logs as JSON
  const dataStr = JSON.stringify(filteredLogs.value, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `update-logs-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Opens the row in a dialog rather than a route.
 *
 * This logged to the console behind a TODO, so clicking a row did nothing
 * visible. A modal keeps the filters, the scroll position and the loaded pages
 * - a log table is somewhere you scan and dip into, and navigating away throws
 * away the position that made the row interesting.
 */
const selectedLog = ref<UpdateLog | null>(null);
const logDialogOpen = ref(false);

const handleSelectLog = (log: UpdateLog) => {
  selectedLog.value = log;
  logDialogOpen.value = true;
};

const selectedCategory = computed(() =>
  selectedLog.value ? classifyUpdateEvent(selectedLog.value.action) : null,
);

/** Only the fields that carry something, so an empty row is never shown. */
const selectedRows = computed(() => {
  const log = selectedLog.value;
  if (!log) return [];

  return [
    { label: "Device", value: log.device_id },
    { label: "App", value: log.app_id },
    { label: "Platform", value: log.platform },
    { label: "From version", value: log.current_version },
    { label: "To version", value: log.new_version },
    { label: "Status", value: log.status },
  ].filter((row) => row.value !== null && row.value !== undefined && row.value !== "");
});

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : "");
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
      v-model:selected-app-id="selectedAppId"
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
            ? "Try adjusting your filters to see more results"
            : "Logs will appear here when devices interact with updates"
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

    <!--
      Row detail, in a dialog. Clicking a row used to `console.warn` behind a
      TODO, so it did nothing visible at all.
    -->
    <Dialog v-model:open="logDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="font-mono text-base">{{ selectedLog?.action }}</DialogTitle>
          <DialogDescription>
            {{ selectedCategory }} event, {{ formatDate(selectedLog?.created_at) }}
          </DialogDescription>
        </DialogHeader>

        <dl class="space-y-2 text-sm">
          <div v-for="row in selectedRows" :key="row.label" class="flex gap-3">
            <dt class="w-32 shrink-0 text-muted-foreground">{{ row.label }}</dt>
            <dd class="flex-1 break-all font-mono text-xs">{{ row.value }}</dd>
          </div>
        </dl>

        <p
          v-if="selectedLog?.error_message"
          class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs"
        >
          {{ selectedLog.error_message }}
        </p>
      </DialogContent>
    </Dialog>
  </div>
</template>
