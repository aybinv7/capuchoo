import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { ComputedRef, InjectionKey } from "vue";

export type ColorMode = "system" | "light" | "dark";

export interface AppContext {
  mode: ColorMode;
  dark: boolean;
  setMode: (mode: ColorMode) => void;
}

export const AppContextKey: InjectionKey<ComputedRef<AppContext>> = Symbol("AppContext");

/**
 * Called once, by the shell. The Material theme is fixed - this is an Android app - so the only
 * choice is light, dark or following the system. Dark mode is Framework7's class on the root and
 * the status bar's style; the M3 scheme already holds both modes, so nothing is regenerated.
 */
export const useAppThemeProvider = (): ComputedRef<AppContext> => {
  const mode = useLocalStorage<ColorMode>("app-color-mode", "system");
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const dark = computed(() => (mode.value === "system" ? prefersDark.value : mode.value === "dark"));

  watch(
    dark,
    (isDark) => {
      f7ready((instance) => instance.setDarkMode(isDark));
      if (Capacitor.isNativePlatform())
        void StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => undefined);
    },
    { flush: "post" },
  );

  const context = computed<AppContext>(() => ({
    mode: mode.value,
    dark: dark.value,
    setMode: (next: ColorMode) => {
      mode.value = next;
    },
  }));

  provide(AppContextKey, context);
  onMounted(() => f7ready((instance) => instance.setDarkMode(dark.value)));
  return context;
};

export const useAppTheme = (): ComputedRef<AppContext> => {
  const context = inject(AppContextKey);
  if (!context) throw new Error("useAppTheme needs useAppThemeProvider() called in a parent component");
  return context;
};
