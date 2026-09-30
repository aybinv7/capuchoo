<script setup lang="ts" generic="T">
import { useVirtualizer } from "@tanstack/vue-virtual";
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    items: readonly T[];
    rowHeight: number;
    /** CSS grid template shared by the header and every row. */
    columns: string;
    itemKey: (item: T) => string;
    height?: string;
    overscan?: number;
  }>(),
  { height: "calc(100svh - 16rem)", overscan: 8 },
);

const emit = defineEmits<{ reachEnd: [] }>();

const scroller = ref<HTMLElement | null>(null);

const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.items.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => props.rowHeight,
    overscan: props.overscan,
    getItemKey: (index: number) => {
      const item = props.items[index];
      return item === undefined ? index : props.itemKey(item);
    },
  })),
);

const rows = computed(() => virtualizer.value.getVirtualItems());
const total = computed(() => virtualizer.value.getTotalSize());

watch(rows, (visible) => {
  const last = visible[visible.length - 1];
  if (last && last.index >= props.items.length - 1 - props.overscan) emit("reachEnd");
});
</script>

<template>
  <div class="overflow-hidden rounded-lg border" role="table">
    <div
      class="bg-surface text-muted-foreground grid items-center gap-3 border-b px-4 py-2 text-xs font-medium"
      :style="{ gridTemplateColumns: props.columns }"
      role="row"
    >
      <slot name="header" />
    </div>
    <div
      ref="scroller"
      class="overflow-y-auto"
      :style="{ maxHeight: props.height }"
      role="rowgroup"
    >
      <div class="relative w-full" :style="{ height: `${total}px` }">
        <div
          v-for="row in rows"
          :key="String(row.key)"
          class="hover:bg-accent/40 absolute inset-x-0 grid items-center gap-3 border-b px-4 text-sm last:border-b-0"
          :style="{
            gridTemplateColumns: props.columns,
            height: `${row.size}px`,
            transform: `translateY(${row.start}px)`,
          }"
          role="row"
        >
          <slot name="row" :item="props.items[row.index]!" :index="row.index" />
        </div>
      </div>
      <slot name="footer" />
    </div>
  </div>
</template>
