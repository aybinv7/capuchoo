import type { ComputedRef } from "vue";
import { activeTabId } from "@/shared/composables/useActiveTab";

// Shell-level state: the tab bar is rendered by the shell, but what hides it - a keyboard, a pushed
// page - happens elsewhere in the tree.
const keyboardOpen = ref(false);

/**
 * Hide requests by the view they were made in. Framework7 keeps every tab's pages mounted, so a
 * single app-wide count stayed above zero on a tab root whenever another tab had a page pushed,
 * and the bar never came back there. A request made outside any view hides the bar everywhere.
 */
const hiddenBy = ref<Record<string, number>>({});
const ANY_VIEW = "*";

export interface TabbarVisibility {
  isVisible: ComputedRef<boolean>;
  setKeyboardOpen: (open: boolean) => void;
  /** Hide the bar while `viewId`'s tab is shown; the returned function restores it. */
  hideTabbar: (viewId?: string | null) => () => void;
}

export function useTabbarVisibility(): TabbarVisibility {
  const pushedHere = computed(
    () => (hiddenBy.value[activeTabId.value] ?? 0) > 0 || (hiddenBy.value[ANY_VIEW] ?? 0) > 0,
  );

  return {
    isVisible: computed(() => !keyboardOpen.value && !pushedHere.value),
    setKeyboardOpen: (open: boolean) => {
      keyboardOpen.value = open;
    },
    hideTabbar: (viewId) => {
      const key = viewId || ANY_VIEW;
      hiddenBy.value = { ...hiddenBy.value, [key]: (hiddenBy.value[key] ?? 0) + 1 };
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = (hiddenBy.value[key] ?? 1) - 1;
        const next = { ...hiddenBy.value };
        if (left > 0) next[key] = left;
        else delete next[key];
        hiddenBy.value = next;
      };
    },
  };
}

/**
 * The tab a page belongs to. Its router knows: Framework7 mounts a routed page before inserting it
 * into the view, so the element has no `.view` ancestor yet when `onMounted` runs. The DOM is the
 * fallback for a component that is not a routed page.
 */
function viewIdOf(instance: ReturnType<typeof getCurrentInstance>): string | null {
  const router = (instance?.props as { f7router?: { view?: { el?: Element } } } | undefined)
    ?.f7router;
  const fromRouter = router?.view?.el?.id;
  if (fromRouter) return fromRouter;
  const root = instance?.proxy?.$el as Element | null | undefined;
  return root instanceof Element ? (root.closest(".view")?.id ?? null) : null;
}

/**
 * Drop this into any pushed page and the tab bar gets out of the way while that page's tab is
 * shown. The bar belongs to the tab roots: on a detail screen it is navigation to somewhere you
 * are not, and it steals a row from content.
 */
export function useHiddenTabbar(): void {
  const { hideTabbar } = useTabbarVisibility();
  const instance = getCurrentInstance();
  let release: (() => void) | null = null;

  onMounted(() => {
    release = hideTabbar(viewIdOf(instance));
  });

  onUnmounted(() => {
    release?.();
    release = null;
  });
}
