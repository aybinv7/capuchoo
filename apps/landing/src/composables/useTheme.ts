import { useColorMode } from "@vueuse/core";
import { computed } from "vue";

/** Light or dark, following the system until the visitor picks one; the key matches index.html. */
export function useTheme() {
  const mode = useColorMode({ storageKey: "capuchoo.theme", disableTransition: false });
  const isDark = computed(() => mode.value === "dark");
  function toggle() {
    mode.store.value = isDark.value ? "light" : "dark";
  }
  return { isDark, toggle };
}
