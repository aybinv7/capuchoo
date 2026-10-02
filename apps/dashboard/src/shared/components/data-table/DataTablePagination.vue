<script setup lang="ts" generic="T">
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "@lucide/vue";
import type { Table } from "@tanstack/vue-table";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { formatCount } from "@/shared/lib/format";
import { PAGE_SIZES } from "./types";

const props = defineProps<{
  table: Table<T>;
  selection: boolean;
  /** Rows the server holds for the current filters, when it says. */
  total: number | null;
  hasMore: boolean;
  loadingMore: boolean;
}>();
const emit = defineEmits<{ next: [] }>();

const state = computed(() => props.table.getState().pagination);
const loaded = computed(() => props.table.getFilteredRowModel().rows.length);
const firstRow = computed(() =>
  loaded.value === 0 ? 0 : state.value.pageIndex * state.value.pageSize + 1,
);
const lastRow = computed(() =>
  Math.min(loaded.value, (state.value.pageIndex + 1) * state.value.pageSize),
);
const pageCount = computed(() => {
  const loadedPages = Math.max(1, props.table.getPageCount());
  if (props.total === null || !props.hasMore) return String(loadedPages);
  return String(Math.max(loadedPages, Math.ceil(props.total / state.value.pageSize)));
});
const of = computed(() => {
  if (props.total !== null) return formatCount(props.total, true);
  return props.hasMore ? `${formatCount(loaded.value, true)}+` : formatCount(loaded.value, true);
});
const selectedCount = computed(() => props.table.getFilteredSelectedRowModel().rows.length);
const groups = computed(() =>
  props.table.getState().grouping.length > 0
    ? props.table.getPrePaginationRowModel().rows.length
    : null,
);
const firstGroup = computed(() =>
  groups.value ? state.value.pageIndex * state.value.pageSize + 1 : 0,
);
const lastGroup = computed(() =>
  Math.min(groups.value ?? 0, (state.value.pageIndex + 1) * state.value.pageSize),
);
const canNext = computed(() => props.table.getCanNextPage() || props.hasMore);

function setPageSize(value: unknown) {
  const size = Number(value);
  if (PAGE_SIZES.includes(size)) props.table.setPageSize(size);
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1 text-sm">
    <div class="text-muted-foreground flex-1 text-xs">
      <template v-if="props.selection && selectedCount > 0">
        {{ formatCount(selectedCount, true) }} of {{ formatCount(loaded, true) }} row(s) selected
      </template>
      <template v-else-if="groups !== null">
        Groups <span class="tabular">{{ firstGroup }}–{{ lastGroup }}</span> of
        <span class="tabular">{{ formatCount(groups, true) }}</span> ·
        <span class="tabular">{{ of }}</span> rows
      </template>
      <template v-else>
        <span class="tabular">{{ firstRow }}–{{ lastRow }}</span> of
        <span class="tabular">{{ of }}</span>
      </template>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-muted-foreground hidden text-xs sm:inline">{{
        groups !== null ? "Groups per page" : "Rows per page"
      }}</span>
      <Select :model-value="String(state.pageSize)" @update:model-value="setPageSize">
        <SelectTrigger size="sm" class="h-8 w-[4.5rem]" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top">
          <SelectItem v-for="size in PAGE_SIZES" :key="size" :value="String(size)">{{
            size
          }}</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="flex items-center gap-1">
      <span class="text-muted-foreground mr-2 text-xs tabular"
        >Page {{ state.pageIndex + 1 }} of {{ pageCount }}</span
      >
      <Button
        variant="outline"
        size="icon-sm"
        class="hidden size-8 lg:inline-flex"
        aria-label="First page"
        :disabled="!props.table.getCanPreviousPage()"
        @click="props.table.firstPage()"
      >
        <ChevronsLeft />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        class="size-8"
        aria-label="Previous page"
        :disabled="!props.table.getCanPreviousPage()"
        @click="props.table.previousPage()"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        class="size-8"
        aria-label="Next page"
        :disabled="!canNext || props.loadingMore"
        @click="emit('next')"
      >
        <Spinner v-if="props.loadingMore" class="size-3.5" />
        <ChevronRight v-else />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        class="hidden size-8 lg:inline-flex"
        aria-label="Last loaded page"
        :disabled="!props.table.getCanNextPage()"
        @click="props.table.lastPage()"
      >
        <ChevronsRight />
      </Button>
    </div>
  </div>
</template>
