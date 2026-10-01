import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vite-plus/test";

/**
 * Dark mode works because no component names a colour. Every surface, text tone and border reads a
 * semantic token, the token flips in `.dark`, and the component never learns which mode it is in.
 * One `text-white` is enough to put white text on a white card the moment the theme changes, and
 * nothing in type-checking or linting will say so - hence this.
 */
const SRC = join(import.meta.dirname, "..", "src");

/**
 * `bootstrapError` paints the failure page when the database never opened, which can be before the
 * stylesheet has applied - it cannot depend on a token existing. The brand constants are the
 * declaration those tokens fall back to, so they are the one place a hex is the point.
 */
const HEX_ALLOWED = ["plugins/bootstrapError.ts", "shared/utils/theme/brand.ts"];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(vue|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

function offenders(pattern: RegExp, skip: string[] = []): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const name = relative(SRC, file).replace(/\\/g, "/");
    if (skip.some((allowed) => name === allowed)) continue;
    for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
      found.push(`${name}: ${match[0]}`);
    }
  }
  return found;
}

test("no component names a literal colour", () => {
  const literals = offenders(
    /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|shadow)-(?:white|black|transparent-\w|\[#[0-9a-fA-F]{3,8}\]|\[rgba?\([^\]]*\)\])/g,
  );
  expect(literals, `use a semantic token instead: ${literals.join(", ")}`).toEqual([]);
});

test("no raw hex outside the brand declaration and the pre-stylesheet failure page", () => {
  const hexes = offenders(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g, HEX_ALLOWED);
  expect(hexes, `move it into a token in theme/tokens.css: ${hexes.join(", ")}`).toEqual([]);
});

/**
 * Framework7's `color` prop and its `text-color-*` helpers set `--f7-theme-color` from f7's own
 * fixed palette, which no token can reach and which does not flip for dark mode.
 */
test("no Framework7 palette prop or colour helper class", () => {
  const f7Colors =
    "red|green|blue|pink|yellow|orange|purple|deeppurple|lightblue|teal|lime|deeporange|white|black|gray";
  const props = offenders(new RegExp(`\\bcolor="(?:${f7Colors})"`, "g"));
  const helpers = offenders(
    new RegExp(`\\b(?:text|bg|border)-color-(?:${f7Colors}|primary)\\b`, "g"),
  );
  const all = [...props, ...helpers];
  expect(all, `use a token class instead: ${all.join(", ")}`).toEqual([]);
});

/**
 * Without `inline`, Tailwind emits `--color-background: var(--background)` on `:root`, which
 * substitutes once at the element it is declared on - so every utility would keep its light value
 * inside `.dark`. The whole dark theme rests on this one keyword.
 *
 * And every colour token is a Material 3 role. A hand-picked value here is how a dark mode ends up
 * in a palette that was never generated from the same seed as the primary.
 */
test("the theme block is inline, and every colour token reads a generated M3 role", () => {
  const css = readFileSync(join(SRC, "assets", "css", "theme", "tokens.css"), "utf8");
  expect(css).toMatch(/@theme\s+inline\s*\{/);

  const start = css.search(/^:root \{/m);
  const tokens = css.slice(start, css.indexOf("\n}", start));
  const handPicked = [...tokens.matchAll(/^\s*(--[a-z-]+):\s*([^;]+);/gm)]
    .filter(([, name]) => !name!.startsWith("--radius") && !name!.startsWith("--elevation"))
    .filter(([, , value]) => !/^var\(--m3-[a-z-]+\)$/.test(value!.trim()))
    .map(([, name, value]) => `${name}: ${value}`);
  expect(handPicked, `map it to a --m3-* role instead: ${handPicked.join(", ")}`).toEqual([]);
});

/**
 * A Framework7 list or block gets its shape from `--f7-list-inset-border-radius` and
 * `--f7-block-inset-border-radius`, set once in `theme/framework7.css`. A radius class on the component is an
 * override fighting the theme, and it makes a screen read as
 * non-native next to one built from defaults.
 */
test("no radius override on a Framework7 list, block or card", () => {
  const overrides = offenders(/<F7(?:List|Block|Card)[^>]*rounded-\[/g);
  expect(overrides, `let the f7 variable shape it: ${overrides.join(", ")}`).toEqual([]);
});
