import { useAppTheme } from "./useAppTheme";
import { useColorTheme } from "./useColorTheme";

/**
 * Theme tokens resolved to colour strings, for the SVG Framework7 draws its charts with: an SVG
 * attribute cannot reference a CSS variable. Read again whenever the scheme or the mode changes.
 */
export function useCssColors<K extends string>(tokens: Record<K, string>) {
  const theme = useAppTheme();
  const { primary, variant } = useColorTheme();
  const generation = ref(0);

  watch(
    [primary, variant, () => theme.value.dark],
    () => requestAnimationFrame(() => (generation.value += 1)),
    { flush: "post" },
  );

  return computed(() => {
    void generation.value;
    const style = getComputedStyle(document.documentElement);
    const out = {} as Record<K, string>;
    for (const key of Object.keys(tokens) as K[])
      out[key] = style.getPropertyValue(tokens[key]).trim() || "currentColor";
    return out;
  });
}
