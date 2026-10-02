<script setup lang="ts" generic="T">
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsUpDown,
  ChevronsDownUp,
  EyeOff,
  Layers,
  Pin,
  PinOff,
  X,
} from "@lucide/vue";
import type { Column } from "@tanstack/vue-table";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MAX_GROUP_LEVELS } from "./lib/grouping";
import type { GroupingState } from "./types";

const props = defineProps<{
  column: Column<T, unknown>;
  title: string;
  reorder: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  grouping: GroupingState;
}>();
const emit = defineEmits<{ moveLeft: []; moveRight: []; group: []; expandAll: [open: boolean] }>();

const sortable = computed(() => props.column.getCanSort());
const pinnable = computed(() => props.column.getCanPin());
const hideable = computed(() => props.column.getCanHide());
const sorted = computed(() => props.column.getIsSorted());
const pinned = computed(() => props.column.getIsPinned());
const groupable = computed(
  () => props.grouping.enabled && Boolean(props.column.columnDef.meta?.groupable),
);
const groupLevel = computed(() => props.grouping.columns.indexOf(props.column.id));
const grouped = computed(() => groupLevel.value !== -1);
const groupingFull = computed(() => props.grouping.columns.length >= MAX_GROUP_LEVELS);
const nestedUnder = computed(() => props.grouping.columns.length - groupLevel.value - 1);
const groupHint = computed(() => {
  if (!props.grouping.available)
    return "Load every row first: a group would count only part of them";
  if (groupingFull.value) return `At most ${MAX_GROUP_LEVELS} levels of grouping`;
  return undefined;
});
const groupedLabel = computed(() => `Grouped, level ${groupLevel.value + 1}`);
const interactive = computed(
  () => sortable.value || pinnable.value || hideable.value || props.reorder || groupable.value,
);
const alignRight = computed(() => props.column.columnDef.meta?.align === "right");
</script>

<template>
  <DropdownMenu v-if="interactive">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :class="
          cn(
            'data-[state=open]:bg-accent -mx-2 h-7 gap-1 px-2 text-xs font-medium',
            alignRight && 'ml-auto flex-row-reverse',
          )
        "
      >
        <span>{{ props.title }}</span>
        <ArrowDown v-if="sorted === 'desc'" class="size-3.5" />
        <ArrowUp v-else-if="sorted === 'asc'" class="size-3.5" />
        <ChevronsUpDown v-else-if="sortable" class="size-3.5 opacity-50" />
        <Pin v-if="pinned" class="text-primary size-3" />
        <span
          v-if="grouped"
          class="text-primary inline-flex items-center gap-0.5"
          :aria-label="groupedLabel"
        >
          <Layers class="size-3" />
          <span v-if="props.grouping.columns.length > 1" class="font-mono text-[10px]">{{
            groupLevel + 1
          }}</span>
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent :align="alignRight ? 'end' : 'start'" class="w-52">
      <template v-if="sortable">
        <DropdownMenuItem @select="props.column.toggleSorting(false, true)">
          <ArrowUp class="size-3.5" />
          Ascending
        </DropdownMenuItem>
        <DropdownMenuItem @select="props.column.toggleSorting(true, true)">
          <ArrowDown class="size-3.5" />
          Descending
        </DropdownMenuItem>
        <DropdownMenuItem v-if="sorted" @select="props.column.clearSorting()">
          <X class="size-3.5" />
          Clear sort
        </DropdownMenuItem>
      </template>
      <template v-if="groupable">
        <DropdownMenuSeparator v-if="sortable" />
        <template v-if="grouped">
          <DropdownMenuItem @select="emit('group')">
            <X class="size-3.5" />
            {{ nestedUnder > 0 ? "Ungroup (and nested)" : "Ungroup" }}
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('expandAll', true)">
            <ChevronsUpDown class="size-3.5" />
            Expand all groups
          </DropdownMenuItem>
          <DropdownMenuItem @select="emit('expandAll', false)">
            <ChevronsDownUp class="size-3.5" />
            Collapse all groups
          </DropdownMenuItem>
        </template>
        <DropdownMenuItem
          v-else
          :disabled="groupHint !== undefined"
          class="items-start"
          @select="emit('group')"
        >
          <Layers class="mt-0.5 size-3.5" />
          <span class="flex min-w-0 flex-col">
            <span
              >{{ props.grouping.columns.length > 0 ? "Group within" : "Group by" }}
              {{ props.title }}</span
            >
            <span v-if="groupHint" class="text-muted-foreground text-[10px] leading-tight">{{
              groupHint
            }}</span>
          </span>
        </DropdownMenuItem>
      </template>
      <template v-if="pinnable">
        <DropdownMenuSeparator v-if="sortable || groupable" />
        <DropdownMenuItem v-if="pinned !== 'left'" @select="props.column.pin('left')">
          <Pin class="size-3.5" />
          Pin left
        </DropdownMenuItem>
        <DropdownMenuItem v-if="pinned !== 'right'" @select="props.column.pin('right')">
          <Pin class="size-3.5 rotate-90" />
          Pin right
        </DropdownMenuItem>
        <DropdownMenuItem v-if="pinned" @select="props.column.pin(false)">
          <PinOff class="size-3.5" />
          Unpin
        </DropdownMenuItem>
      </template>
      <template v-if="props.reorder && !pinned">
        <DropdownMenuSeparator v-if="sortable || pinnable" />
        <DropdownMenuItem :disabled="!props.canMoveLeft" @select="emit('moveLeft')">
          <ArrowLeft class="size-3.5" />
          Move left
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!props.canMoveRight" @select="emit('moveRight')">
          <ArrowRight class="size-3.5" />
          Move right
        </DropdownMenuItem>
      </template>
      <template v-if="hideable">
        <DropdownMenuSeparator v-if="sortable || pinnable || props.reorder" />
        <DropdownMenuItem @select="props.column.toggleVisibility(false)">
          <EyeOff class="size-3.5" />
          Hide column
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
  <span v-else class="text-xs font-medium">{{ props.title }}</span>
</template>
