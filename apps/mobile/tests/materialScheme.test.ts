import { Hct, argbFromHex } from "@material/material-color-utilities";
import { expect, test } from "vite-plus/test";
import { buildScheme, schemeStylesheet } from "../src/shared/composables/theme/materialScheme.js";
import { BRAND_PRIMARY, ENVIRONMENT_COLORS } from "../src/shared/utils/theme/brand.js";

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
  const brand = Hct.fromInt(argbFromHex(BRAND_PRIMARY));
  for (const dark of [false, true]) {
    const container = Hct.fromInt(argbFromHex(buildScheme(dark)["primary-container"]));
    expect(hueDistance(container.hue, brand.hue)).toBeLessThan(5);
    expect(Math.abs(container.tone - brand.tone)).toBeLessThan(8);
  }
});

test("surfaces are quiet: near-neutral in both modes, never the seed's pink", () => {
  for (const dark of [false, true]) {
    const surface = Hct.fromInt(argbFromHex(buildScheme(dark).surface));
    expect(surface.chroma).toBeLessThan(4);
  }
});

test("environment colours are the dashboard's, unblended, in light mode", () => {
  const light = buildScheme(false);
  for (const name of ["dev", "staging", "prod"] as const) {
    expect(hueDistance(hue(light[name]), hue(ENVIRONMENT_COLORS[name]))).toBeLessThan(8);
  }
});

test("text on every surface and container meets 4.5:1", () => {
  for (const dark of [false, true]) {
    const s = buildScheme(dark);
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
    for (const [fg, bg] of pairs) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("one stylesheet holds both modes and Framework7's variables", () => {
  const css = schemeStylesheet();
  expect(css).toMatch(/^:root\{--m3-primary:#[0-9a-f]{6};/);
  expect(css).toContain(":root.dark{");
  expect(css).toContain("--f7-md-primary:");
  expect(css).toContain("--m3-prod-container:");
});
