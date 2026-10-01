import type { Ref } from "vue";
import { easeOutCubic } from "@/shared/utils/motion/spring";
import { isArmed, pullFraction } from "@/shared/utils/motion/pullToRefresh";

/** Movement before a touch counts as a pull or a sideways swipe - Android's touch slop, 8dp. */
const TOUCH_SLOP_PX = 8;
const SETTLE_MS = 250;
/**
 * A refresh that answers in 40 ms would flash the indicator and read as a glitch. Two morphs is
 * long enough to register as "it refreshed" and short enough not to feel slow.
 */
const MIN_REFRESH_MS = 1300;

export interface PullToRefresh {
  /** 0 hidden, 1 at the threshold, up to 2 at full over-pull. */
  fraction: Ref<number>;
  refreshing: Ref<boolean>;
}

/**
 * The pull, read from the page's own scroller. A pull starts only at the very top and only when
 * the finger moves down before it moves sideways, so carousels, swipeouts and ordinary scrolling
 * keep their gestures. While pulling, the page's native overscroll is held back so the indicator
 * is the only thing that moves.
 */
export function usePullToRefresh(
  scroller: Ref<HTMLElement | null>,
  onRefresh: () => Promise<void>,
): PullToRefresh {
  const fraction = ref(0);
  const refreshing = ref(false);

  let tracking = false;
  let pulling = false;
  let startX = 0;
  let startY = 0;
  let pulled = 0;
  let settleFrame = 0;

  function settle(to: number): Promise<void> {
    cancelAnimationFrame(settleFrame);
    const from = fraction.value;
    if (from === to) return Promise.resolve();
    const startedAt = performance.now();
    return new Promise((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - startedAt) / SETTLE_MS);
        fraction.value = from + (to - from) * easeOutCubic(t);
        if (t < 1) settleFrame = requestAnimationFrame(step);
        else resolve();
      };
      settleFrame = requestAnimationFrame(step);
    });
  }

  async function refresh(): Promise<void> {
    refreshing.value = true;
    const startedAt = performance.now();
    try {
      await Promise.all([settle(1), onRefresh()]);
    } catch (error) {
      console.error("[refresh] the page could not be refreshed", error);
    } finally {
      const left = MIN_REFRESH_MS - (performance.now() - startedAt);
      if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
      await settle(0);
      refreshing.value = false;
    }
  }

  function onTouchStart(event: TouchEvent): void {
    const el = scroller.value;
    if (!el || refreshing.value || event.touches.length !== 1 || el.scrollTop > 0) return;
    const touch = event.touches[0]!;
    tracking = true;
    pulling = false;
    startX = touch.clientX;
    startY = touch.clientY;
    pulled = 0;
  }

  function onTouchMove(event: TouchEvent): void {
    const el = scroller.value;
    if (!tracking || !el) return;
    const touch = event.touches[0]!;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!pulling) {
      if (Math.abs(dx) > TOUCH_SLOP_PX && Math.abs(dx) > Math.abs(dy)) {
        tracking = false;
        return;
      }
      if (dy < -TOUCH_SLOP_PX || el.scrollTop > 0) {
        tracking = false;
        return;
      }
      if (dy <= TOUCH_SLOP_PX) return;
      pulling = true;
      startY = touch.clientY;
    }

    pulled = touch.clientY - startY;
    if (event.cancelable) event.preventDefault();
    fraction.value = pullFraction(pulled);
  }

  function onTouchEnd(): void {
    if (!tracking) return;
    tracking = false;
    if (!pulling) return;
    pulling = false;
    if (isArmed(pulled)) void refresh();
    else void settle(0);
  }

  let bound: HTMLElement | null = null;

  function bind(el: HTMLElement | null): void {
    if (bound === el) return;
    if (bound) {
      bound.removeEventListener("touchstart", onTouchStart);
      bound.removeEventListener("touchmove", onTouchMove);
      bound.removeEventListener("touchend", onTouchEnd);
      bound.removeEventListener("touchcancel", onTouchEnd);
    }
    bound = el;
    if (!el) return;
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
  }

  watch(scroller, bind, { immediate: true });

  onBeforeUnmount(() => {
    bind(null);
    cancelAnimationFrame(settleFrame);
  });

  return { fraction, refreshing };
}
