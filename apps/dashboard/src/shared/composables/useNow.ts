import { readonly, ref, type Ref } from "vue";

const TICK_MS = 15_000;
const now = ref(Date.now());
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * One shared clock for every relative timestamp on screen, so a table of a thousand rows costs one
 * interval rather than a thousand. Call `release` from `onScopeDispose`.
 */
export function useNow(): { now: Readonly<Ref<number>>; release: () => void } {
  subscribers += 1;
  if (!timer) {
    now.value = Date.now();
    timer = setInterval(() => {
      now.value = Date.now();
    }, TICK_MS);
  }
  let released = false;
  return {
    now: readonly(now),
    release() {
      if (released) return;
      released = true;
      subscribers -= 1;
      if (subscribers === 0 && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
}
