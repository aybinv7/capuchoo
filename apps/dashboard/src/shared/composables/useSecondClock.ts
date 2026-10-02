import {
  onScopeDispose,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

const now = ref(Date.now());
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe() {
  subscribers += 1;
  now.value = Date.now();
  timer ??= setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

function unsubscribe() {
  subscribers -= 1;
  if (subscribers > 0 || !timer) return;
  clearInterval(timer);
  timer = undefined;
}

/**
 * One shared one-second clock for durations that tick. A caller holds a subscription only while
 * `active` is true, so a page of finished jobs runs no interval at all and a page of running ones
 * runs exactly one.
 */
export function useSecondClock(active: MaybeRefOrGetter<boolean>): Readonly<Ref<number>> {
  let held = false;
  const sync = (value: boolean) => {
    if (value && !held) subscribe();
    if (!value && held) unsubscribe();
    held = value;
  };
  watch(() => toValue(active), sync, { immediate: true });
  onScopeDispose(() => sync(false));
  return readonly(now);
}
