import type { Ref } from "vue";
import { buildScheme, type SchemeVariant } from "@/shared/composables/theme/materialScheme";

export interface SchemePreview {
  primary: string;
  secondary: string;
  tertiary: string;
  surface: string;
}

function preview(seed: string, variant: SchemeVariant, dark: boolean): SchemePreview {
  const scheme = buildScheme(seed, variant, dark);
  return {
    primary: scheme.primary,
    secondary: scheme["secondary-container"],
    tertiary: scheme["tertiary-container"],
    surface: scheme["surface-container"],
  };
}

/**
 * What each choice would look like before it is made: every preset in the current style, and
 * every style on the current seed, in the current mode. Fourteen schemes, regenerated only when
 * the seed, the style or the mode moves.
 */
export function useSchemePreviews(
  seeds: readonly string[],
  variants: readonly SchemeVariant[],
  primary: Ref<string>,
  variant: Ref<SchemeVariant>,
  dark: Ref<boolean>,
) {
  const bySeed = computed(() => seeds.map((seed) => preview(seed, variant.value, dark.value)));
  const byVariant = computed(() =>
    variants.map((option) => preview(primary.value, option, dark.value)),
  );
  return { bySeed, byVariant };
}
