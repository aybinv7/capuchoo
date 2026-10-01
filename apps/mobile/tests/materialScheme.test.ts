import { Hct, argbFromHex } from "@material/material-color-utilities";
import { expect, test } from "vite-plus/test";
import {
  SCHEME_VARIANTS,
  buildScheme,
  schemeStylesheet,
} from "../src/shared/composables/theme/materialScheme.js";
import {
  BRAND_PRIMARY,
  ENVIRONMENT_COLORS,
  THEME_PRESETS,
} from "../src/shared/utils/theme/brand.js";

const brand = (dark: boolean) => buildScheme(BRAND_PRIMARY, "brand", dark);

/** WCAG relative-luminance contrast, the measure the 4.5:1 body-text floor is written in. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const value = argbFromHex(hex);
    const channel = (shift: number) => {
      const c = ((value >> shift) & 255) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const hue = (hex: string) => Hct.fromInt(argbFromHex(hex)).hue;
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test("the primary containers stay the brand terracotta, moved only in tone", () => {
  const seed = Hct.fromInt(argbFromHex(BRAND_PRIMARY));
  for (const dark of [false, true]) {
    const container = Hct.fromInt(argbFromHex(brand(dark)["primary-container"]));
    expect(hueDistance(container.hue, seed.hue)).toBeLessThan(5);
    expect(Math.abs(container.tone - seed.tone)).toBeLessThan(8);
  }
});

test("surfaces are quiet: near-neutral in both modes, never the seed's pink", () => {
  for (const dark of [false, true]) {
    const surface = Hct.fromInt(argbFromHex(brand(dark).surface));
    expect(surface.chroma).toBeLessThan(4);
  }
});

test("environment colours are the dashboard's, unblended, in light mode", () => {
  const light = brand(false);
  for (const name of ["dev", "staging", "prod"] as const) {
    expect(hueDistance(hue(light[name]), hue(ENVIRONMENT_COLORS[name]))).toBeLessThan(8);
  }
});

test("text on every surface and container meets 4.5:1", () => {
  for (const dark of [false, true]) {
    const s = brand(dark);
    const pairs: Array<[string, string]> = [
      [s["on-surface"], s.surface],
      [s["on-surface-variant"], s["surface-container"]],
      [s["on-primary"], s.primary],
      [s["on-primary-container"], s["primary-container"]],
      [s["on-secondary-container"], s["secondary-container"]],
      [s["on-error-container"], s["error-container"]],
      [s["on-dev-container"], s["dev-container"]],
      [s["on-staging-container"], s["staging-container"]],
      [s["on-prod-container"], s["prod-container"]],
    ];
    for (const [fg, bg] of pairs)
      expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("one stylesheet holds both modes and Framework7's variables", () => {
  const css = schemeStylesheet(BRAND_PRIMARY, "brand");
  expect(css).toMatch(/^:root\{--m3-primary:#[0-9a-f]{6};/);
  expect(css).toContain(":root.dark{");
  expect(css).toContain("--f7-md-primary:");
  expect(css).toContain("--m3-prod-container:");
});

test("every preset in every variant keeps text on its roles at 4.5:1", () => {
  for (const preset of THEME_PRESETS) {
    for (const variant of SCHEME_VARIANTS) {
      for (const dark of [false, true]) {
        const s = buildScheme(preset.hex, variant, dark);
        const pairs: Array<[string, string]> = [
          [s["on-surface"], s.surface],
          [s["on-primary"], s.primary],
          [s["on-primary-container"], s["primary-container"]],
          [s["on-secondary-container"], s["secondary-container"]],
        ];
        for (const [fg, bg] of pairs) {
          expect(
            contrast(fg, bg),
            `${preset.id} ${variant} ${dark ? "dark" : "light"}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  }
});

test("only the brand variant keeps the paper neutrals; the others tint surfaces with the seed", () => {
  const seed = "#3082b5";
  const paper = Hct.fromInt(argbFromHex(buildScheme(seed, "brand", false)["surface-container"]));
  const tinted = Hct.fromInt(
    argbFromHex(buildScheme(seed, "tonalSpot", false)["surface-container"]),
  );
  expect(paper.chroma).toBeLessThan(4);
  expect(hueDistance(tinted.hue, hue(seed))).toBeLessThan(30);
});

test("the environments keep their colours whatever seed is picked", () => {
  const light = buildScheme("#5c6bc0", "vibrant", false);
  for (const name of ["dev", "staging", "prod"] as const) {
    expect(hueDistance(hue(light[name]), hue(ENVIRONMENT_COLORS[name]))).toBeLessThan(8);
  }
});
