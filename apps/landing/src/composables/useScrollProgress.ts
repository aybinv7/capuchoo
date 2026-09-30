import { useEventListener, useIntersectionObserver } from "@vueuse/core";
import { onMounted, ref, type Ref } from "vue";

export type ScrollRange = "through" | "enter";

/**
 * How far an element has travelled through the viewport, from 0 to 1. `through` spans from the
 * element's top reaching the viewport top to its bottom reaching the viewport bottom (a sticky
 * section); `enter` spans from its top entering at the bottom to reaching the top (an element
 * settling into place). Reads layout once per animation frame, only while the element is near
 * the viewport.
 */
export function useScrollProgress(target: Ref<HTMLElement | null>, range: ScrollRange = "through") {
  const progress = ref(0);
  const visible = ref(false);
  let frame = 0;

  function measure() {
    frame = 0;
    const element = target.value;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const viewport = window.innerHeight;
    const value =
      range === "through"
        ? -rect.top / Math.max(1, rect.height - viewport)
        : (viewport - rect.top) / Math.max(1, viewport);
    const clamped = Math.min(1, Math.max(0, value));
    if (Math.abs(clamped - progress.value) > 0.001) progress.value = clamped;
  }

  function schedule() {
    if (!visible.value || frame) return;
    frame = requestAnimationFrame(measure);
  }

  useIntersectionObserver(
    target,
    ([entry]) => {
      visible.value = Boolean(entry?.isIntersecting);
      if (visible.value) schedule();
    },
    { rootMargin: "25% 0px 25% 0px" },
  );
  useEventListener(window, "scroll", schedule, { passive: true });
  useEventListener(window, "resize", schedule, { passive: true });
  onMounted(schedule);

  return { progress, visible };
}
