<script setup lang="ts">
import type { DateRange } from "reka-ui";
import { getLocalTimeZone, today, CalendarDate } from "@internationalized/date";
import { RangeCalendar } from "@/components/ui/range-calendar";
import {
  CalendarIcon,
  Search,
  X,
  Filter,
  RefreshCw,
  ChevronDown,
  Boxes,
  Download as DownloadIcon,
} from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { useAppsQuery } from "@/modules/apps/composables/useAppsQuery";

//TODO: remove the any type on date range
// Props & Emits
const props = defineProps<{
  searchQuery: string;
  selectedAppId: string;
  selectedActions: string[];
  selectedPlatforms: string[];
  dateRange: any;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "update:selectedAppId", value: string): void;
  (e: "update:selectedActions", value: string[]): void;
  (e: "update:selectedPlatforms", value: string[]): void;
  (e: "update:dateRange", value: DateRange): void;
  (e: "refresh"): void;
  (e: "clear"): void;
  (e: "export"): void;
}>();

const { data: apps } = useAppsQuery();

/**
 * The actions `update_logs_action_check` permits, after migration 003.
 *
 * Three of the seven offered before - `install_fail`, `first_open` and a
 * `download_fail` spelling the constraint does allow but nothing emits - could
 * never match a row, because Postgres rejects any value outside that list. A
 * filter that cannot match anything is worse than no filter: it reads as "there
 * were no failures".
 */
const actionOptions = [
  { value: "get", label: "Update check", color: "bg-gray-500" },
  { value: "update_available", label: "Update available", color: "bg-amber-500" },
  { value: "no_update_available", label: "No update", color: "bg-gray-500" },
  { value: "download", label: "Download", color: "bg-blue-500" },
  { value: "download_complete", label: "Download complete", color: "bg-blue-500" },
  { value: "download_failed", label: "Download failed", color: "bg-red-500" },
  { value: "install", label: "Install", color: "bg-green-500" },
  { value: "set", label: "Bundle applied", color: "bg-purple-500" },
  { value: "app_ready", label: "App ready", color: "bg-green-500" },
  { value: "update_failed", label: "Update failed", color: "bg-red-500" },
  { value: "native_update_required", label: "Native required", color: "bg-amber-500" },
];

// Platform options
const platformOptions = [
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
];

// Active filter count
const activeFilterCount = computed(() => {
  let count = 0;
  if (props.searchQuery) count++;
  if (props.selectedAppId) count++;
  if (props.selectedActions.length > 0) count++;
  if (props.selectedPlatforms.length > 0) count++;
  if (props.dateRange.start) count++;
  return count;
});

// Toggle action
const toggleAction = (action: string) => {
  const current = [...props.selectedActions];
  const idx = current.indexOf(action);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(action);
  }
  emit("update:selectedActions", current);
};

// Toggle platform
const togglePlatform = (platform: string) => {
  const current = [...props.selectedPlatforms];
  const idx = current.indexOf(platform);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(platform);
  }
  emit("update:selectedPlatforms", current);
};

// Date display text
const dateDisplayText = computed(() => {
  if (!props.dateRange.start) return "Select date range";
  const start = props.dateRange.start;
  const end = props.dateRange.end;
  if (end) {
    return `${start.month}/${start.day}/${start.year} - ${end.month}/${end.day}/${end.year}`;
  }
  return `${start.month}/${start.day}/${start.year}`;
});

// Quick preset handlers
const setPreset = (preset: "today" | "yesterday" | "last7" | "last30") => {
  const tz = getLocalTimeZone();
  const now = today(tz);
  let start: CalendarDate;
  let end: CalendarDate = now;

  switch (preset) {
    case "today":
      start = now;
      break;
    case "yesterday":
      start = now.subtract({ days: 1 });
      end = start;
      break;
    case "last7":
      start = now.subtract({ days: 7 });
      break;
    case "last30":
      start = now.subtract({ days: 30 });
      break;
    default:
      start = now;
  }

  emit("update:dateRange", { start, end });
};
</script>

<template>
  <div class="space-y-4">
    <!-- Filter Bar -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- App selector. Filtered server-side, unlike everything else here: the
           endpoint takes app_id and the list is capped at `limit` rows, so
           narrowing in the browser would only ever filter the newest 100 events
           across every app rather than the newest 100 for the one you want. -->
      <Select
        :model-value="selectedAppId"
        @update:model-value="emit('update:selectedAppId', ($event as string) ?? '')"
      >
        <SelectTrigger class="min-w-[200px]">
          <div class="flex items-center gap-2 truncate">
            <Boxes class="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="All apps" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All apps</SelectItem>
          <SelectItem v-for="app in apps ?? []" :key="app.id" :value="app.app_id">
            {{ app.name || app.app_id }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- Search Input -->
      <div class="relative flex-1 min-w-[200px] max-w-[400px]">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          :model-value="searchQuery"
          @update:model-value="emit('update:searchQuery', $event as string)"
          placeholder="Search by device, version, action or error..."
          class="pl-10 pr-10"
        />
        <button
          v-if="searchQuery"
          @click="emit('update:searchQuery', '')"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Date Range Picker using Popover + RangeCalendar -->
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            :class="
              cn(
                'min-w-[260px] justify-start text-left font-normal',
                !dateRange.start && 'text-muted-foreground',
              )
            "
          >
            <CalendarIcon class="mr-2 h-4 w-4" />
            {{ dateDisplayText }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="start">
          <div class="p-3 border-b flex gap-2">
            <Button variant="ghost" size="sm" @click="setPreset('today')">Today</Button>
            <Button variant="ghost" size="sm" @click="setPreset('yesterday')">Yesterday</Button>
            <Button variant="ghost" size="sm" @click="setPreset('last7')">Last 7 days</Button>
            <Button variant="ghost" size="sm" @click="setPreset('last30')">Last 30 days</Button>
          </div>
          <RangeCalendar
            :model-value="dateRange"
            @update:model-value="emit('update:dateRange', $event)"
            :number-of-months="2"
            class="p-3"
          />
        </PopoverContent>
      </Popover>

      <!-- Actions Filter -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="default"
            :class="selectedActions.length > 0 && 'border-primary'"
          >
            <Filter class="h-4 w-4 mr-2" />
            Actions
            <Badge v-if="selectedActions.length > 0" variant="secondary" class="ml-2 h-5 px-1.5">
              {{ selectedActions.length }}
            </Badge>
            <ChevronDown class="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-48">
          <DropdownMenuCheckboxItem
            v-for="action in actionOptions"
            :key="action.value"
            :checked="selectedActions.includes(action.value)"
            @update:checked="toggleAction(action.value)"
          >
            <div class="flex items-center gap-2">
              <div :class="cn('h-2 w-2 rounded-full', action.color)" />
              {{ action.label }}
            </div>
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Platform Filter -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="default"
            :class="selectedPlatforms.length > 0 && 'border-primary'"
          >
            Platform
            <Badge v-if="selectedPlatforms.length > 0" variant="secondary" class="ml-2 h-5 px-1.5">
              {{ selectedPlatforms.length }}
            </Badge>
            <ChevronDown class="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuCheckboxItem
            v-for="platform in platformOptions"
            :key="platform.value"
            :checked="selectedPlatforms.includes(platform.value)"
            @update:checked="togglePlatform(platform.value)"
          >
            {{ platform.label }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Refresh & Export -->
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="emit('refresh')" :disabled="isLoading">
          <RefreshCw :class="cn('h-4 w-4', isLoading && 'animate-spin')" />
        </Button>
        <Button variant="outline" size="sm" @click="emit('export')">
          <DownloadIcon class="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>

    <!-- Active Filters Tags -->
    <div v-if="activeFilterCount > 0" class="flex items-center gap-2 flex-wrap">
      <span class="text-sm text-muted-foreground">Filters:</span>

      <Badge v-if="searchQuery" variant="secondary" class="gap-1 pr-1">
        "{{ searchQuery }}"
        <button
          @click="emit('update:searchQuery', '')"
          class="ml-1 rounded-full hover:bg-muted p-0.5"
        >
          <X class="h-3 w-3" />
        </button>
      </Badge>

      <Badge v-if="dateRange.start" variant="secondary" class="gap-1 pr-1">
        {{ dateDisplayText }}
        <button
          @click="emit('update:dateRange', {} as DateRange)"
          class="ml-1 rounded-full hover:bg-muted p-0.5"
        >
          <X class="h-3 w-3" />
        </button>
      </Badge>

      <Badge v-for="action in selectedActions" :key="action" variant="secondary" class="gap-1 pr-1">
        {{ actionOptions.find((a) => a.value === action)?.label }}
        <button @click="toggleAction(action)" class="ml-1 rounded-full hover:bg-muted p-0.5">
          <X class="h-3 w-3" />
        </button>
      </Badge>

      <Badge
        v-for="platform in selectedPlatforms"
        :key="platform"
        variant="secondary"
        class="gap-1 pr-1"
      >
        {{ platform }}
        <button @click="togglePlatform(platform)" class="ml-1 rounded-full hover:bg-muted p-0.5">
          <X class="h-3 w-3" />
        </button>
      </Badge>

      <Button variant="ghost" size="sm" class="h-7" @click="emit('clear')"> Clear all </Button>
    </div>
  </div>
</template>
