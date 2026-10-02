import { useEventListener, useResizeObserver } from "@vueuse/core";
import {
  computed,
  nextTick,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export interface VirtualRowsOptions {
  /** The element that scrolls; rows are laid out inside it at a fixed height each. */
  container: Readonly<Ref<HTMLElement | null>>;
  count: MaybeRefOrGetter<number>;
  rowHeight: number;
  /** Rows drawn beyond each edge so a fast scroll does not show blanks. */
  overscan?: number;
  /** When false every row is drawn and nothing is measured. */
  enabled: MaybeRefOrGetter<boolean>;
}

/**
 * Windowing for a list of fixed-height rows in its own scroll container: only the rows in view
 * (plus `overscan`) are drawn. Scroll reads are coalesced to one per frame and the window only
 * changes when the first visible row does, so scrolling within a row re-renders nothing.
 */
export function useVirtualRows(options: VirtualRowsOptions) {
  const overscan = options.overscan ?? 20;
  const first = shallowRef(0);
  const visible = shallowRef(0);
  let frame = 0;

  function measure() {
    frame = 0;
    const element = options.container.value;
    if (!element || !toValue(options.enabled)) return;
    const top = Math.floor(element.scrollTop / options.rowHeight);
    const rows = Math.ceil(element.clientHeight / options.rowHeight);
    if (top !== first.value) first.value = top;
    if (rows !== visible.value) visible.value = rows;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(measure);
  }

  useEventListener(options.container, "scroll", schedule, { passive: true });
  useResizeObserver(options.container, schedule);
  watch(
    () => [toValue(options.enabled), toValue(options.count)],
    () => void nextTick(measure),
    { immediate: true },
  );
  onScopeDispose(() => cancelAnimationFrame(frame));

  const range = computed(() => {
    const count = toValue(options.count);
    if (!toValue(options.enabled)) return { start: 0, end: count };
    const rows = visible.value || 40;
    const start = Math.max(0, Math.min(first.value, count) - overscan);
    const end = Math.min(count, first.value + rows + overscan);
    return { start, end };
  });

  return {
    range,
    offset: computed(() => range.value.start * options.rowHeight),
    totalHeight: computed(() => toValue(options.count) * options.rowHeight),
    /** Scrolls so row `index` sits a third of the way down the container. */
    scrollToRow(index: number) {
      const element = options.container.value;
      if (!element) return;
      element.scrollTop = Math.max(0, index * options.rowHeight - element.clientHeight / 3);
      schedule();
    },
  };
}
