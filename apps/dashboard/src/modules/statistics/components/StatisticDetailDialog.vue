<script setup lang="ts">
/**
 * What a statistic card is made of, without leaving the page.
 *
 * A modal rather than a route: the numbers are a single view of one app over
 * one time range, and pushing a route would discard the range, the scroll
 * position and the loaded queries to show four rows of breakdown. Every card
 * opens the same dialog with a different slice.
 */
import { computed } from "vue";
import type { ActionBreakdown, EventSummary } from "../types/statistics.types";

const props = defineProps<{
  open: boolean;
  title: string;
  value: string | number;
  description: string;
  /** Per-action rows, already filtered to what this card counts. */
  rows: ActionBreakdown[];
  summary?: EventSummary | undefined;
  /** Shown when there is nothing to break down, which is not an error. */
  emptyHint: string;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit("update:open", value),
});

const total = computed(() => props.rows.reduce((sum, row) => sum + row.count, 0));

const share = (count: number) => (total.value === 0 ? 0 : Math.round((count / total.value) * 100));

const CATEGORY_STYLE: Record<string, string> = {
  delivered: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  downloading: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  check: "bg-muted text-muted-foreground",
  lifecycle: "bg-muted text-muted-foreground",
  cancelled: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  other: "bg-muted text-muted-foreground",
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="text-3xl font-bold tabular-nums">{{ value }}</div>

        <div v-if="rows.length" class="space-y-2">
          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">By event</p>
          <div
            v-for="row in rows"
            :key="row.action"
            class="flex items-center gap-3 rounded-md border p-2"
          >
            <span
              class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              :class="CATEGORY_STYLE[row.category] ?? CATEGORY_STYLE.other"
            >
              {{ row.category }}
            </span>
            <code class="flex-1 truncate text-xs">{{ row.action }}</code>
            <span class="text-sm font-medium tabular-nums">{{ row.count }}</span>
            <span class="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {{ share(row.count) }}%
            </span>
          </div>
        </div>

        <!--
          An empty breakdown is a fact, not a failure. The card it replaces
          showed a fabricated number in this exact situation, which is why the
          hint says what would produce a row rather than just "no data".
        -->
        <p v-else class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {{ emptyHint }}
        </p>

        <div v-if="summary" class="grid grid-cols-3 gap-2 border-t pt-3 text-center">
          <div>
            <div class="text-sm font-medium tabular-nums">{{ summary.total }}</div>
            <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Events</div>
          </div>
          <div>
            <div class="text-sm font-medium tabular-nums">{{ summary.delivered }}</div>
            <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Delivered</div>
          </div>
          <div>
            <div class="text-sm font-medium tabular-nums">{{ summary.failed }}</div>
            <div class="text-[10px] uppercase tracking-wider text-muted-foreground">Failed</div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
