/**
 * Capuchoo's colours, converted from the dashboard's OKLCH tokens (`apps/dashboard/src/assets/
 * styles/main.css`) so the phone and the dashboard are one product. Everything else is an M3 role
 * generated from these.
 */
export const BRAND_PRIMARY = "#c96442";

/** Environment colours, the same three everywhere a channel appears. */
export const ENVIRONMENT_COLORS = {
  dev: "#9c87f5",
  staging: "#d58d25",
  prod: "#348f4f",
} as const;

export const BRAND_INFO = "#3082b5";

/**
 * Seeds the colour page offers, each one Material renders well in both modes. The first is
 * Capuchoo's; the environment colours are deliberately among them, so a person who lives in one
 * channel can make the app match it.
 */
export const THEME_PRESETS = [
  { id: "terracotta", hex: BRAND_PRIMARY },
  { id: "amber", hex: ENVIRONMENT_COLORS.staging },
  { id: "forest", hex: ENVIRONMENT_COLORS.prod },
  { id: "teal", hex: "#00897b" },
  { id: "ocean", hex: BRAND_INFO },
  { id: "indigo", hex: "#5c6bc0" },
  { id: "violet", hex: ENVIRONMENT_COLORS.dev },
  { id: "rose", hex: "#d81b60" },
] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];
