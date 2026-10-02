<script setup lang="ts" generic="T">
import { ChevronRight } from "@lucide/vue";
import type { Row, Table } from "@tanstack/vue-table";
import { computed } from "vue";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCount } from "@/shared/lib/format";
import { groupValueLabel } from "./lib/grouping";
import type { Density } from "./types";

const props = defineProps<{
  row: Row<T>;
  table: Table<T>;
  colspan: number;
  density: Density;
  selection: boolean;
}>();

const PADDING: Record<Density, string> = {
  compact: "h-8 py-1 text-xs",
  normal: "h-10 py-1.5 text-sm",
  comfortable: "h-12 py-2 text-sm",
};

const column = computed(() =>
  props.row.groupingColumnId ? props.table.getColumn(props.row.groupingColumnId) : undefined,
);
const label = computed(() => {
  const meta = column.value?.columnDef.meta;
  return groupValueLabel(props.row.groupingValue, meta?.groupLabel ?? meta?.facetLabel);
});
const count = computed(() => props.row.getLeafRows().filter((leaf) => !leaf.getIsGrouped()).length);
const expanded = computed(() => props.row.getIsExpanded());
const selected = computed<boolean | "indeterminate">(() => {
  if (props.row.getIsAllSubRowsSelected()) return true;
  return props.row.getIsSomeSelected() ? "indeterminate" : false;
});
</script>

<template>
  <TableRow
    class="bg-muted/40 hover:bg-muted/60 border-b"
    :data-depth="props.row.depth"
    data-group-row
  >
    <TableCell :colspan="props.colspan" :class="cn('px-3', PADDING[props.density])">
      <div
        class="flex min-w-0 items-center gap-2"
        :style="{ paddingLeft: `${props.row.depth * 20}px` }"
      >
        <Checkbox
          v-if="props.selection"
          :model-value="selected"
          :aria-label="`Select the ${count} rows of ${label.text}`"
          @update:model-value="props.row.toggleSelected(!props.row.getIsAllSubRowsSelected())"
        />
        <button
          type="button"
          class="hover:text-foreground focus-visible:ring-ring/50 -my-1 flex min-w-0 items-center gap-2 rounded-sm py-1 outline-none focus-visible:ring-2"
          :aria-expanded="expanded"
          @click="props.row.toggleExpanded()"
        >
          <ChevronRight
            class="text-muted-foreground size-3.5 shrink-0 transition-transform duration-150"
            :class="expanded && 'rotate-90'"
          />
          <span class="text-muted-foreground shrink-0 text-xs">{{
            column?.columnDef.meta?.title ?? props.row.groupingColumnId
          }}</span>
          <span
            class="truncate font-medium"
            :class="label.empty && 'text-muted-foreground italic'"
            :title="label.text"
            >{{ label.text }}</span
          >
          <span
            class="bg-background text-muted-foreground shrink-0 rounded-full border px-1.5 font-mono text-[10px] leading-4 tabular"
            >{{ formatCount(count, true) }}</span
          >
        </button>
      </div>
    </TableCell>
  </TableRow>
</template>
