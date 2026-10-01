import {
  DynamicScheme,
  Hct,
  MaterialDynamicColors,
  SchemeFidelity,
  SchemeTonalSpot,
  TonalPalette,
  Variant,
  argbFromHex,
  customColor,
  hexFromArgb,
} from "@material/material-color-utilities";
import { BRAND_INFO, BRAND_PRIMARY, ENVIRONMENT_COLORS } from "@/shared/utils/theme/brand";

/** The M3 roles the app reads, by the CSS name each is published under (`--m3-<name>`). */
const ROLES = {
  primary: MaterialDynamicColors.primary,
  "on-primary": MaterialDynamicColors.onPrimary,
  "primary-container": MaterialDynamicColors.primaryContainer,
  "on-primary-container": MaterialDynamicColors.onPrimaryContainer,
  "primary-fixed": MaterialDynamicColors.primaryFixed,
  "primary-fixed-dim": MaterialDynamicColors.primaryFixedDim,
  secondary: MaterialDynamicColors.secondary,
  "on-secondary": MaterialDynamicColors.onSecondary,
  "secondary-container": MaterialDynamicColors.secondaryContainer,
  "on-secondary-container": MaterialDynamicColors.onSecondaryContainer,
  tertiary: MaterialDynamicColors.tertiary,
  "on-tertiary": MaterialDynamicColors.onTertiary,
  "tertiary-container": MaterialDynamicColors.tertiaryContainer,
  "on-tertiary-container": MaterialDynamicColors.onTertiaryContainer,
  error: MaterialDynamicColors.error,
  "on-error": MaterialDynamicColors.onError,
  "error-container": MaterialDynamicColors.errorContainer,
  "on-error-container": MaterialDynamicColors.onErrorContainer,
  surface: MaterialDynamicColors.surface,
  "surface-dim": MaterialDynamicColors.surfaceDim,
  "surface-bright": MaterialDynamicColors.surfaceBright,
  "surface-container-lowest": MaterialDynamicColors.surfaceContainerLowest,
  "surface-container-low": MaterialDynamicColors.surfaceContainerLow,
  "surface-container": MaterialDynamicColors.surfaceContainer,
  "surface-container-high": MaterialDynamicColors.surfaceContainerHigh,
  "surface-container-highest": MaterialDynamicColors.surfaceContainerHighest,
  "on-surface": MaterialDynamicColors.onSurface,
  "on-surface-variant": MaterialDynamicColors.onSurfaceVariant,
  outline: MaterialDynamicColors.outline,
  "outline-variant": MaterialDynamicColors.outlineVariant,
  "inverse-surface": MaterialDynamicColors.inverseSurface,
  "inverse-on-surface": MaterialDynamicColors.inverseOnSurface,
  "inverse-primary": MaterialDynamicColors.inversePrimary,
  scrim: MaterialDynamicColors.scrim,
} as const;

/**
 * Extra colours with their four tones. The environments are not blended toward the primary: dev
 * is violet, staging amber and prod green on the dashboard, and a channel must read the same here.
 */
const EXTRAS = {
  dev: { value: ENVIRONMENT_COLORS.dev, blend: false },
  staging: { value: ENVIRONMENT_COLORS.staging, blend: false },
  prod: { value: ENVIRONMENT_COLORS.prod, blend: false },
  info: { value: BRAND_INFO, blend: true },
} as const;

type Extra = keyof typeof EXTRAS;
export type SchemeRole = keyof typeof ROLES | `${"" | "on-"}${Extra}${"" | "-container"}`;
export type SchemeColors = Record<SchemeRole, string>;

const SPEC = "2025";

/**
 * The neutrals: the dashboard's parchment is a yellow of almost no chroma, and its hue taken
 * straight reads olive in the dark tones. A warm hue between it and the brand, kept quiet, gives
 * the same paper in light mode and the dashboard's near-neutral charcoal in dark.
 */
const NEUTRAL_HUE = 70;
const NEUTRAL_CHROMA = 3;
const NEUTRAL_VARIANT_CHROMA = 6;

/**
 * Fidelity's primary palette for the brand - its containers stay within a few tones of the seed,
 * moved only as far as text contrast needs (white on the seed is 3.6:1) - with Tonal Spot's quieter
 * secondary and tertiary, and quiet warm neutrals instead of the seed's own, which would tint
 * every surface pink.
 */
function createScheme(isDark: boolean): DynamicScheme {
  const source = Hct.fromInt(argbFromHex(BRAND_PRIMARY));
  const fidelity = new SchemeFidelity(source, isDark, 0, SPEC);
  const tonal = new SchemeTonalSpot(source, isDark, 0, SPEC);
  return new DynamicScheme({
    sourceColorHct: source,
    variant: Variant.FIDELITY,
    contrastLevel: 0,
    isDark,
    specVersion: SPEC,
    primaryPalette: fidelity.primaryPalette,
    secondaryPalette: tonal.secondaryPalette,
    tertiaryPalette: tonal.tertiaryPalette,
    neutralPalette: TonalPalette.fromHueAndChroma(NEUTRAL_HUE, NEUTRAL_CHROMA),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(NEUTRAL_HUE, NEUTRAL_VARIANT_CHROMA),
  });
}

export function buildScheme(isDark: boolean): SchemeColors {
  const scheme = createScheme(isDark);
  const colors = {} as SchemeColors;
  for (const [name, role] of Object.entries(ROLES)) {
    colors[name as keyof typeof ROLES] = hexFromArgb(role.getArgb(scheme));
  }

  const source = argbFromHex(BRAND_PRIMARY);
  for (const [name, extra] of Object.entries(EXTRAS) as Array<[Extra, (typeof EXTRAS)[Extra]]>) {
    const group = customColor(source, { name, value: argbFromHex(extra.value), blend: extra.blend });
    const tones = isDark ? group.dark : group.light;
    colors[name] = hexFromArgb(tones.color);
    colors[`on-${name}`] = hexFromArgb(tones.onColor);
    colors[`${name}-container`] = hexFromArgb(tones.colorContainer);
    colors[`on-${name}-container`] = hexFromArgb(tones.onColorContainer);
  }
  return colors;
}

function rgbTriple(hex: string): string {
  const value = argbFromHex(hex);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].join(", ");
}

function toneShift(hex: string, delta: number): string {
  const hct = Hct.fromInt(argbFromHex(hex));
  return hexFromArgb(Hct.from(hct.hue, hct.chroma, Math.min(100, Math.max(0, hct.tone + delta))).toInt());
}

/**
 * Framework7 derives its own Material palette only from Tonal Spot, Vibrant or Monochrome, so its
 * variables point at this scheme: a toggle, a ripple and a sheet then agree with every card.
 */
function framework7Variables(colors: SchemeColors): Record<string, string> {
  return {
    "--f7-md-primary": colors.primary,
    "--f7-md-primary-rgb": rgbTriple(colors.primary),
    "--f7-md-primary-shade": toneShift(colors.primary, -6),
    "--f7-md-primary-tint": toneShift(colors.primary, 6),
    "--f7-md-on-primary": colors["on-primary"],
    "--f7-md-primary-container": colors["primary-container"],
    "--f7-md-on-primary-container": colors["on-primary-container"],
    "--f7-md-secondary": colors.secondary,
    "--f7-md-on-secondary": colors["on-secondary"],
    "--f7-md-secondary-container": colors["secondary-container"],
    "--f7-md-on-secondary-container": colors["on-secondary-container"],
    "--f7-md-surface": colors.surface,
    "--f7-md-surface-rgb": rgbTriple(colors.surface),
    "--f7-md-surface-variant": colors["surface-dim"],
    "--f7-md-surface-1": colors["surface-container-low"],
    "--f7-md-surface-2": colors["surface-container"],
    "--f7-md-surface-3": colors["surface-container-high"],
    "--f7-md-surface-4": colors["surface-container-highest"],
    "--f7-md-surface-5": colors["surface-container-highest"],
    "--f7-md-surface-1-rgb": rgbTriple(colors["surface-container-low"]),
    "--f7-md-surface-2-rgb": rgbTriple(colors["surface-container"]),
    "--f7-md-surface-3-rgb": rgbTriple(colors["surface-container-high"]),
    "--f7-md-surface-4-rgb": rgbTriple(colors["surface-container-highest"]),
    "--f7-md-surface-5-rgb": rgbTriple(colors["surface-container-highest"]),
    "--f7-md-on-surface": colors["on-surface"],
    "--f7-md-on-surface-variant": colors["on-surface-variant"],
    "--f7-md-outline": colors.outline,
    "--f7-md-outline-variant": colors["outline-variant"],
    "--f7-md-inverse-surface": colors["inverse-surface"],
    "--f7-md-inverse-on-surface": colors["inverse-on-surface"],
    "--f7-md-inverse-primary": colors["inverse-primary"],
  };
}

function declarations(colors: SchemeColors): string {
  const own = Object.entries(colors).map(([name, value]) => `--m3-${name}:${value};`);
  const f7 = Object.entries(framework7Variables(colors)).map(([name, value]) => `${name}:${value};`);
  return [...own, ...f7].join("");
}

export function schemeStylesheet(): string {
  return `:root{${declarations(buildScheme(false))}}:root.dark{${declarations(buildScheme(true))}}`;
}

const STYLE_ID = "capuchoo-material-scheme";

/**
 * Both modes are written at once, so dark mode is Framework7's `.dark` class and nothing else - no
 * regeneration, no flash. Appended after Framework7's own generated palette, which it prepends, so
 * these win at equal specificity and `:root.dark` outranks its `.dark`.
 */
export function applyMaterialScheme(): void {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = schemeStylesheet();
}
