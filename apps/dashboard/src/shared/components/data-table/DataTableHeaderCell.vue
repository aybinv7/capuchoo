<script setup lang="ts" generic="T">
import { FlexRender, type Header } from "@tanstack/vue-table";
import { computed, ref } from "vue";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import DataTableColumnHeader from "./DataTableColumnHeader.vue";
import { pinningEdge, pinningStyle } from "./lib/pinning";

const DRAG_TYPE = "application/x-capuchoo-column";

const props = defineProps<{
  header: Header<T, unknown>;
  order: readonly string[];
  reorder: boolean;
}>();
const emit = defineEmits<{ move: [id: string, target: string] }>();

const column = computed(() => props.header.column);
const meta = computed(() => column.value.columnDef.meta);
const title = computed(() => meta.value?.title ?? column.value.id);
const usesMenu = computed(
  () => typeof column.value.columnDef.header !== "function" && Boolean(meta.value?.title),
);
const movable = computed(() => props.reorder && !meta.value?.fixed && !column.value.getIsPinned());
const position = computed(() => props.order.indexOf(column.value.id));

/** The nearest visible column this one can swap with; fixed and pinned columns stop the walk. */
function neighbour(step: -1 | 1): string | undefined {
  const table = props.header.getContext().table;
  for (let index = position.value + step; index >= 0 && index < props.order.length; index += step) {
    const other = table.getColumn(props.order[index]!);
    if (!other || !other.getIsVisible()) continue;
    if (other.columnDef.meta?.fixed || other.getIsPinned()) return undefined;
    return other.id;
  }
  return undefined;
}
const dropping = ref(false);

function onDragStart(event: DragEvent) {
  if (!movable.value || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(DRAG_TYPE, column.value.id);
}

function onDragOver(event: DragEvent) {
  if (!movable.value || !event.dataTransfer?.types.includes(DRAG_TYPE)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  dropping.value = true;
}

function onDrop(event: DragEvent) {
  dropping.value = false;
  const source = event.dataTransfer?.getData(DRAG_TYPE);
  if (!movable.value || !source || source === column.value.id) return;
  event.preventDefault();
  emit("move", source, column.value.id);
}

function moveBy(step: -1 | 1) {
  const target = neighbour(step);
  if (target) emit("move", column.value.id, target);
}
</script>

<template>
  <TableHead
    :colspan="props.header.colSpan"
    :draggable="movable"
    :style="pinningStyle(column)"
    :class="
      cn(
        'bg-surface h-9 px-3',
        meta?.align === 'right' && 'text-right',
        meta?.align === 'center' && 'text-center',
        column.getIsPinned() && 'z-[2]',
        pinningEdge(column),
        movable && 'cursor-grab active:cursor-grabbing',
        dropping && 'shadow-[inset_2px_0_0_var(--primary)]',
        meta?.headerClass,
      )
    "
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="dropping = false"
    @drop="onDrop"
  >
    <template v-if="!props.header.isPlaceholder">
      <DataTableColumnHeader
        v-if="usesMenu"
        :column="column"
        :title="title"
        :reorder="movable"
        :can-move-left="neighbour(-1) !== undefined"
        :can-move-right="neighbour(1) !== undefined"
        @move-left="moveBy(-1)"
        @move-right="moveBy(1)"
      />
      <FlexRender v-else :render="column.columnDef.header" :props="props.header.getContext()" />
    </template>
  </TableHead>
</template>
