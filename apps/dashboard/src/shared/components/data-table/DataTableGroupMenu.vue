<script setup lang="ts" generic="T">
import { ChevronsDownUp, ChevronsUpDown, Layers, X } from "@lucide/vue";
import type { Table } from "@tanstack/vue-table";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MAX_GROUP_LEVELS } from "./lib/grouping";

const props = defineProps<{
  table: Table<T>;
  grouping: readonly string[];
  /** False while only part of the rows is loaded: a group would count a slice. */
  available: boolean;
}>();
const emit = defineEmits<{ toggle: [id: string]; expandAll: [open: boolean] }>();

const columns = computed(() =>
  props.table
    .getAllLeafColumns()
    .filter((column) => column.columnDef.meta?.groupable && !column.columnDef.meta?.fixed),
);
const titleOf = (id: string) => {
  const column = props.table.getColumn(id);
  return column?.columnDef.meta?.title ?? id;
};
const summary = computed(() => props.grouping.map(titleOf).join(" › "));
const full = computed(() => props.grouping.length >= MAX_GROUP_LEVELS);
</script>

<template>
  <Tooltip v-if="!props.available">
    <TooltipTrigger as-child>
      <span tabindex="0">
        <Button variant="outline" size="sm" class="h-8" disabled>
          <Layers />
          <span class="hidden lg:inline">Group</span>
        </Button>
      </span>
    </TooltipTrigger>
    <TooltipContent>Load every row to group them; a group would count only a part.</TooltipContent>
  </Tooltip>
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="h-8 max-w-64"
        :class="props.grouping.length > 0 && 'border-primary/40 bg-primary/5'"
      >
        <Layers />
        <span v-if="props.grouping.length === 0" class="hidden lg:inline">Group</span>
        <span v-else class="truncate">
          <span class="text-muted-foreground hidden lg:inline">Group: </span>{{ summary }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel class="text-muted-foreground flex items-center justify-between text-xs">
        Group rows by
        <span class="font-normal tabular">{{ props.grouping.length }}/{{ MAX_GROUP_LEVELS }}</span>
      </DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        v-for="column in columns"
        :key="column.id"
        :model-value="props.grouping.includes(column.id)"
        :disabled="full && !props.grouping.includes(column.id)"
        @update:model-value="emit('toggle', column.id)"
        @select.prevent
      >
        <span class="flex-1">{{ column.columnDef.meta?.title ?? column.id }}</span>
        <span
          v-if="props.grouping.includes(column.id)"
          class="bg-muted text-muted-foreground rounded px-1 font-mono text-[10px] tabular"
          >{{ props.grouping.indexOf(column.id) + 1 }}</span
        >
      </DropdownMenuCheckboxItem>
      <template v-if="props.grouping.length > 0">
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="emit('expandAll', true)">
          <ChevronsUpDown />
          Expand all
        </DropdownMenuItem>
        <DropdownMenuItem @select="emit('expandAll', false)">
          <ChevronsDownUp />
          Collapse all
        </DropdownMenuItem>
        <DropdownMenuItem @select="emit('toggle', props.grouping[0]!)">
          <X />
          Ungroup
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
