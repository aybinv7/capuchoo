import { usePreferredReducedMotion } from "@vueuse/core";
import { computed } from "vue";

/** True when the visitor asked for less motion; scroll-linked effects fall back to static. */
export function useReducedMotion() {
  const preference = usePreferredReducedMotion();
  return computed(() => preference.value === "reduce");
}
