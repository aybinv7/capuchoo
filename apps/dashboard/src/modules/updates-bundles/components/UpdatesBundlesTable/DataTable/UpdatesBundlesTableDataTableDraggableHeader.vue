<template>
  <TableHeader class="bg-background w-full">
    <DndKitDroppable
      id="header-droppable"
      :data="{ type: 'header-group' }"
      :onDrop="handleHeaderDrop"
      class="w-full contents"
    >
      <template #default="{ isOver }">
        <TableRow
          v-for="headerGroup in table?.getHeaderGroups()"
          :key="headerGroup.id"
          class="border-b bg-muted/50 sticky top-0 w-full"
          :class="{ 'bg-primary/10': isOver }"
        >
          <TableHead
            v-for="header in headerGroup.headers"
            :key="header.id"
            :class="[
              cellPadding,
              header.column.getIsPinned() ? 'sticky z-20 bg-background' : 'relative',
              header.column.getIsPinned() === 'left' ? 'left-0' : '',
              header.column.getIsPinned() === 'right' ? 'right-0' : '',
            ]"
            :style="{
              width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined,
              minWidth: header.column.columnDef.minSize
                ? `${header.column.columnDef.minSize}px`
                : undefined,
              maxWidth: header.column.columnDef.maxSize
                ? `${header.column.columnDef.maxSize}px`
                : undefined,
              ...(header.column.getIsPinned() === 'left' && {
                left: `${table
                  .getLeftVisibleLeafColumns()
                  .reduce(
                    (sum, col, index) =>
                      index <
                      table.getLeftVisibleLeafColumns().findIndex((c) => c.id === header.column.id)
                        ? sum + (table.getColumn(col.id)?.getSize() || 0)
                        : sum,
                    0,
                  )}px`,
                zIndex: 20,
              }),
              ...(header.column.getIsPinned() === 'right' && {
                right: `${table
                  .getRightVisibleLeafColumns()
                  .reduce(
                    (sum, col, index) =>
                      index >
                      table.getRightVisibleLeafColumns().findIndex((c) => c.id === header.column.id)
                        ? sum + (table.getColumn(col.id)?.getSize() || 0)
                        : sum,
                    0,
                  )}px`,
                zIndex: 20,
              }),
            }"
            :data-header-id="header.id"
          >
            <!-- Resizer -->

            <!-- Draggable wrapper for column header -->
            <DndKitDraggable
              v-if="
                tableState.features.enableColumnOrdering &&
                !((header.column.columnDef.meta as any)?.['disableDragging'] ?? false)
              "
              :id="header.id"
              :data="{ columnId: header.column.id, type: 'header' }"
            >
              <template #default="{ attributes, listeners, isDragging }">
                <div
                  :class="{
                    'opacity-50': isDragging,
                    'cursor-move': !(
                      (header.column.columnDef.meta as any)?.['disableDragging'] ?? false
                    ),
                    'cursor-default':
                      (header.column.columnDef.meta as any)?.['disableDragging'] ?? false,
                    'animate-highlight': dragEndedColumn === header.column.id,
                  }"
                  class="flex items-center gap-2"
                  v-bind="attributes"
                  v-on="listeners"
                  @animationend="
                    () => {
                      if (dragEndedColumn === header.column.id) dragEndedColumn = null
                    }
                  "
                >
                  <ILucideGripVertical
                    v-if="!((header.column.columnDef.meta as any)?.['disableDragging'] ?? false)"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <FlexRender
                    v-if="!header.isPlaceholder"
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                </div>
              </template>
            </DndKitDraggable>

            <!-- Non-draggable header when ordering is disabled -->
            <FlexRender
              v-else-if="!header.isPlaceholder"
              :render="header.column.columnDef.header"
              :props="header.getContext()"
            />

            <div
              v-if="header.column.getCanResize()"
              @mousedown="header.getResizeHandler()?.($event)"
              @touchstart="header.getResizeHandler()?.($event)"
              class="absolute top-1/2 -translate-y-1/2 right-0 z-30 bg-border w-1 h-[50%] rounded-md opacity-10 hover:bg-primary hover:opacity-100 transition-all duration-300 ease-in-out cursor-col-resize select-none touch-none"
              :class="{
                'bg-primary w-2': header.column.getIsResizing(),
              }"
              @click.stop
              @pointerdown.stop
            />
          </TableHead>
        </TableRow>
      </template>
    </DndKitDroppable>
  </TableHeader>
</template>

<script setup lang="ts" generic="TData, TValue">
import type { Table } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import DndKitDraggable from '@/components/dnd-kit/DndKitDraggable.vue'
import DndKitDroppable from '@/components/dnd-kit/DndKitDroppable.vue'

interface DataTableDraggableHeaderProps {
  table: Table<TData>
  cellPadding: string
  tableState: any
}

const props = defineProps<DataTableDraggableHeaderProps>()

const getDropPosition = (event: DragEvent, headers: any[]) => {
  if (!event.target) return -1

  const target = event.target as HTMLElement
  const targetHeader = target.closest('[data-header-id]')

  if (!targetHeader) return -1

  const targetId = (targetHeader as HTMLElement).dataset.headerId
  const targetIndex = headers.findIndex((h: any) => h.id === targetId)

  const rect = targetHeader.getBoundingClientRect()
  const isLeftHalf = event.clientX < rect.left + rect.width / 2

  return isLeftHalf ? targetIndex : targetIndex + 1
}

const dragEndedColumn = ref(null)

const handleHeaderDrop = (data: any, event: DragEvent) => {
  if (!data || data.type !== 'header') return

  const draggedColumnId = data.columnId

  const allHeaders = []
  for (const headerGroup of props.table.getHeaderGroups()) {
    for (const header of headerGroup.headers) {
      allHeaders.push(header)
    }
  }

  const dropPosition = getDropPosition(event, allHeaders)

  if (!draggedColumnId || dropPosition === -1 || !props.tableState) return

  const currentOrder = [...props.tableState.columnOrder.value]
  const draggedIndex = currentOrder.indexOf(draggedColumnId)

  if (draggedIndex !== -1 && draggedIndex !== dropPosition) {
    const [movedColumn] = currentOrder.splice(draggedIndex, 1)

    const adjustedDropPosition = dropPosition > draggedIndex ? dropPosition - 1 : dropPosition

    currentOrder.splice(adjustedDropPosition, 0, movedColumn)

    props.tableState.onColumnOrderChange(currentOrder)

    dragEndedColumn.value = draggedColumnId
  }
}
</script>

<style scoped>
.animate-highlight {
  animation: highlight 0.6s ease;
}

@keyframes highlight {
  50% {
    transform: scale(1.03);
  }
  100% {
    transform: scale(1);
  }
}
</style>
