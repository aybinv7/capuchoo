import type { Ref } from "vue";
import {
  applyMaterialScheme,
  SCHEME_VARIANTS,
  type SchemeVariant,
} from "@/shared/composables/theme/materialScheme";
import { BRAND_PRIMARY, THEME_PRESETS } from "@/shared/utils/theme/brand";

const DEFAULT_VARIANT: SchemeVariant = "brand";
const HEX = /^#[0-9a-f]{6}$/i;

/** Framework7 9 ships a working `setColorTheme`, but its `.d.ts` stops short of it. */
interface ColorThemeApi {
  setColorTheme: (hexColor: string) => void;
}

/** Defaults are not written back, so changing a default reaches everyone who never chose. */
const storedPrimary = useLocalStorage("app-color-primary", BRAND_PRIMARY, { writeDefaults: false });
const storedVariant = useLocalStorage<string>("app-color-variant", DEFAULT_VARIANT, {
  writeDefaults: false,
});

/** A value from an older build, or a hand-edited one, falls back rather than breaking the palette. */
const primary = computed<string>({
  get: () => (HEX.test(storedPrimary.value) ? storedPrimary.value.toLowerCase() : BRAND_PRIMARY),
  set: (next) => {
    if (HEX.test(next)) storedPrimary.value = next.toLowerCase();
  },
});

const variant = computed<SchemeVariant>({
  get: () =>
    SCHEME_VARIANTS.includes(storedVariant.value as SchemeVariant)
      ? (storedVariant.value as SchemeVariant)
      : DEFAULT_VARIANT,
  set: (next) => {
    storedVariant.value = next;
  },
});

function apply(): void {
  applyMaterialScheme(primary.value, variant.value);
}

/** Before mount, so the first frame is already in the chosen palette. */
export function applyStoredColorScheme(): void {
  try {
    apply();
  } catch (error) {
    console.error("[theme] the colour scheme could not be generated", error);
    applyMaterialScheme(BRAND_PRIMARY, DEFAULT_VARIANT);
  }
}

let started = false;

/**
 * Called once by the shell, inside `f7ready`. Framework7 still gets the seed for its own derived
 * tints; the scheme stylesheet then overrides its Material variables with ours.
 */
export function startColorTheme(): void {
  if (started) return;
  started = true;
  watch(
    [primary, variant],
    () => {
      try {
        (f7 as unknown as ColorThemeApi | undefined)?.setColorTheme(primary.value);
        apply();
      } catch (error) {
        console.error("[theme] the colour scheme could not be applied", error);
      }
    },
    { immediate: true },
  );
}

export interface ColorThemeContext {
  primary: Ref<string>;
  variant: Ref<SchemeVariant>;
  variants: readonly SchemeVariant[];
  presets: typeof THEME_PRESETS;
  isDefault: Readonly<Ref<boolean>>;
  reset: () => void;
}

export function useColorTheme(): ColorThemeContext {
  return {
    primary,
    variant,
    variants: SCHEME_VARIANTS,
    presets: THEME_PRESETS,
    isDefault: computed(() => primary.value === BRAND_PRIMARY && variant.value === DEFAULT_VARIANT),
    reset: () => {
      primary.value = BRAND_PRIMARY;
      variant.value = DEFAULT_VARIANT;
    },
  };
}
