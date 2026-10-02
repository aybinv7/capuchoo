import { useResizeObserver } from "@vueuse/core";
import { nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import { fitWithinRows } from "../lib/wrap-fit";

/**
 * How many items of a wrapping list fit in `rows` rows. `mirror` is an invisible copy of the full
 * list laid out at the same width; its children are measured whenever it resizes or the list
 * is replaced, so the visible list never has to render everything first.
 */
export function useWrapOverflow(
  mirror: Ref<HTMLElement | null>,
  items: MaybeRefOrGetter<readonly unknown[]>,
  rows: number,
) {
  const visible = ref(toValue(items).length);

  function measure() {
    const element = mirror.value;
    if (!element) return;
    const tops = Array.from(element.children, (child) => (child as HTMLElement).offsetTop);
    visible.value = fitWithinRows(tops, rows);
  }

  useResizeObserver(mirror, measure);
  watch(
    () => toValue(items),
    () => void nextTick(measure),
    { immediate: true },
  );

  return visible;
}
