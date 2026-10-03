<script setup lang="ts">
import { KeyRound } from "@lucide/vue";
import { computed, useTemplateRef } from "vue";
import { cn } from "@/lib/utils";
import { useVirtualRows } from "@/shared/composables/useVirtualRows";
import type { RowView, TableView } from "../../lib/db-model";
import { displayValue } from "../../lib/display";

const props = defineProps<{
  table: TableView;
  rows: readonly RowView[];
  /** Wall clock of the playhead, for the flash on rows that just changed. */
  playhead: number;
}>();

const ROW_HEIGHT = 30;
const FLASH_MS = 1500;

const scroller = useTemplateRef<HTMLElement>("scroller");
const windowed = useVirtualRows({
  container: scroller,
  count: computed(() => props.rows.length),
  rowHeight: ROW_HEIGHT,
  enabled: computed(() => props.rows.length > 80),
});
const visible = computed(() => {
  const { start, end } = windowed.range.value;
  return props.rows.slice(start, end);
});

const template = computed(
  () =>
    `2.25rem ${props.table.columns.map((_, index) => (props.table.keyColumns.includes(index) ? "minmax(4.5rem,max-content)" : "minmax(7rem,1fr)")).join(" ")}`,
);

const STATUS: Record<RowView["status"], { row: string; mark: string; label: string }> = {
  baseline: { row: "", mark: "bg-transparent", label: "" },
  inserted: { row: "bg-success-soft/70", mark: "bg-success", label: "Inserted" },
  updated: { row: "bg-warning-soft/60", mark: "bg-warning", label: "Updated" },
  deleted: {
    row: "bg-danger-soft/70 text-muted-foreground line-through decoration-destructive/40",
    mark: "bg-destructive",
    label: "Deleted",
  },
};

const fresh = (row: RowView) =>
  row.changedAt !== null &&
  props.playhead - row.changedAt >= 0 &&
  props.playhead - row.changedAt < FLASH_MS;
</script>

<template>
  <div ref="scroller" class="relative h-full min-h-0 overflow-auto font-mono text-[11px]">
    <div class="min-w-max">
      <div
        class="bg-muted/80 text-muted-foreground sticky top-0 z-10 grid border-b backdrop-blur"
        :style="{ gridTemplateColumns: template }"
        role="row"
      >
        <span aria-hidden="true" />
        <span
          v-for="(column, index) in props.table.columns"
          :key="column"
          class="flex items-center gap-1 truncate px-2 py-1.5 font-sans text-[11px] font-medium"
          role="columnheader"
        >
          <KeyRound
            v-if="props.table.keyColumns.includes(index)"
            class="text-primary size-3 shrink-0"
            aria-label="Key"
          />
          {{ column }}
        </span>
      </div>
      <div class="relative" :style="{ height: `${windowed.totalHeight.value}px` }" role="rowgroup">
        <div :style="{ transform: `translateY(${windowed.offset.value}px)` }">
          <div
            v-for="row in visible"
            :key="row.key"
            :class="
              cn(
                'grid items-center border-b border-border/60 transition-colors duration-500',
                STATUS[row.status].row,
                fresh(row) && 'ring-primary/60 animate-pulse ring-1 ring-inset',
              )
            "
            :style="{ gridTemplateColumns: template, height: `${ROW_HEIGHT}px` }"
            role="row"
            :title="STATUS[row.status].label || undefined"
          >
            <span class="flex h-full items-center justify-center" aria-hidden="true">
              <span :class="cn('h-4 w-1 rounded-full', STATUS[row.status].mark)" />
            </span>
            <span
              v-for="(column, index) in props.table.columns"
              :key="column"
              :class="
                cn(
                  'truncate px-2',
                  row.changed.has(index) &&
                    row.status !== 'deleted' &&
                    'bg-warning-soft text-foreground font-semibold',
                  row.values[index] === null && 'text-muted-foreground/70 italic',
                )
              "
              :title="
                row.changed.has(index)
                  ? `was ${displayValue(row.changed.get(index)) || 'empty'}`
                  : displayValue(row.values[index])
              "
              role="cell"
              >{{ displayValue(row.values[index]) }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
