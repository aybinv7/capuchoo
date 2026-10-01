import type { ComputedRef } from "vue";

// Shell-level state: the tab bar is rendered by the shell, but what hides it - a keyboard, a pushed
// page - happens elsewhere in the tree.
const keyboardOpen = ref(false);
const hiddenRequests = ref(0);

export interface TabbarVisibility {
  isVisible: ComputedRef<boolean>;
  setKeyboardOpen: (open: boolean) => void;
  hideTabbar: () => () => void;
}

export function useTabbarVisibility(): TabbarVisibility {
  return {
    isVisible: computed(() => !keyboardOpen.value && hiddenRequests.value === 0),
    setKeyboardOpen: (open: boolean) => {
      keyboardOpen.value = open;
    },
    /** Hide the bar for as long as the caller needs it; the returned function restores it. */
    hideTabbar: () => {
      hiddenRequests.value += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        hiddenRequests.value -= 1;
      };
    },
  };
}

/**
 * Drop this into any pushed page and the tab bar gets out of the way for as long as that page is
 * mounted. The bar belongs to the tab roots: on a detail or a search screen it is navigation to
 * somewhere you are not, and it steals a row from content.
 */
export function useHiddenTabbar(): void {
  const { hideTabbar } = useTabbarVisibility();
  let release: (() => void) | null = null;

  onMounted(() => {
    release = hideTabbar();
  });

  onUnmounted(() => {
    release?.();
    release = null;
  });
}
