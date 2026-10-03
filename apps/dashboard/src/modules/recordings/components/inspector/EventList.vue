<script setup lang="ts" generic="T extends { id: string; t: number }">
import { computed, useTemplateRef, watch } from "vue";
import { cn } from "@/lib/utils";
import { useVirtualRows } from "@/shared/composables/useVirtualRows";
import { formatOffset } from "../../lib/activity";
import { lastAtOrBefore } from "../../lib/lanes";

const props = withDefaults(
  defineProps<{
    items: readonly T[];
    /** Wall-clock time of the playhead. */
    playhead: number;
    /** Wall-clock start of the timeline, for the offset column. */
    origin: number;
    selectedId: string | null;
    follow: boolean;
    rowHeight?: number;
    emptyLabel: string;
  }>(),
  { rowHeight: 34 },
);
const emit = defineEmits<{ select: [item: T]; seek: [time: number] }>();
defineSlots<{ row(props: { item: T }): unknown }>();

const scroller = useTemplateRef<HTMLElement>("scroller");
const windowed = useVirtualRows({
  container: scroller,
  count: computed(() => props.items.length),
  rowHeight: props.rowHeight,
  enabled: computed(() => props.items.length > 60),
});

const current = computed(() => lastAtOrBefore(props.items, props.playhead));
const visible = computed(() => {
  const { start, end } = windowed.range.value;
  return props.items.slice(start, end).map((item, index) => ({ item, index: start + index }));
});

watch(current, (index) => {
  if (props.follow && index >= 0) windowed.scrollToRow(index);
});

function choose(item: T) {
  emit("select", item);
  emit("seek", item.t);
}
</script>

<template>
  <div ref="scroller" class="h-full min-h-0 overflow-y-auto" role="list">
    <p
      v-if="props.items.length === 0"
      class="text-muted-foreground px-4 py-10 text-center text-sm text-pretty"
    >
      {{ props.emptyLabel }}
    </p>
    <div v-else class="relative" :style="{ height: `${windowed.totalHeight.value}px` }">
      <div :style="{ transform: `translateY(${windowed.offset.value}px)` }">
        <button
          v-for="{ item, index } in visible"
          :key="item.id"
          type="button"
          role="listitem"
          :style="{ height: `${props.rowHeight}px` }"
          :class="
            cn(
              'hover:bg-accent/60 flex w-full items-center gap-2 border-l-2 border-transparent pr-3 pl-2 text-left text-xs transition-colors',
              index === current && 'border-primary bg-primary/5',
              item.id === props.selectedId && 'bg-accent',
              item.t > props.playhead && 'opacity-50',
            )
          "
          @click="choose(item)"
        >
          <span class="text-muted-foreground tabular w-11 shrink-0 font-mono text-[10px]">{{
            formatOffset(item.t - props.origin)
          }}</span>
          <slot name="row" :item="item" />
        </button>
      </div>
    </div>
  </div>
</template>
