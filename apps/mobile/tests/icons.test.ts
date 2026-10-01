import { readFileSync, readdirSync, statSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

/**
 * Material Icons is a ligature font, so a name the font does not carry renders as the literal word
 * - "more_horiz" sitting in the top bar instead of a glyph. That is louder than the silent
 * blank the Framework7 font used to give us, but it is still a shipped bug, and the names are no
 * more guessable: it is `delete`, not `trash`, and `add`, not `plus`.
 *
 * So the bundled font is the authority, the same way Framework7Icons-Regular.ttf was before the app
 * went Material-only. Ligature names appear as plain ASCII once the woff2 is decompressed, which is
 * enough to tell a real name from an invented one.
 */
const FONT_DIR = join(import.meta.dirname, "..", "src", "assets", "fonts");

/**
 * woff2 stores the font tables as one brotli block behind a variable-length table directory, so the
 * offset depends on how many tables the font has. Scanning for the block is shorter than parsing
 * the directory and cannot silently read the wrong bytes: a wrong offset does not decompress.
 */
function ligatureText(file: string): string {
  const buffer = readFileSync(join(FONT_DIR, file));
  for (let start = 40; start < 600; start += 1) {
    try {
      const tables = brotliDecompressSync(buffer.subarray(start));
      if (tables.length > 10_000) return tables.toString("latin1");
    } catch {
      // Not the start of the block; the next offset is the only thing to try.
    }
  }
  throw new Error(`no brotli-compressed table block found in ${file}`);
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(vue|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Matches the `material:name` form, both literal and inside a template string. */
function usedIconNames(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(join(import.meta.dirname, "..", "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/material:([a-z][a-z0-9_]*)/g)) names.add(match[1]!);
  }
  return [...names].sort();
}

/**
 * The names reached through a `material:${...}` template never appear next to the prefix, so they
 * are collected from the fields that feed one. Miss a field here and its names go unchecked.
 */
function boundIconNames(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(join(import.meta.dirname, "..", "src"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\b(?:icon|iconMd)\s*[:=]\s*"([a-z][a-z0-9_]*)"/g)) {
      names.add(match[1]!);
    }
  }
  return [...names].sort();
}

test("every Material icon name used in the app exists in the bundled font", () => {
  const font = ligatureText("material-icons-round.woff2");
  const used = [...new Set([...usedIconNames(), ...boundIconNames()])];

  // A guard that never looks at anything is worse than no guard.
  expect(used.length).toBeGreaterThan(10);

  const missing = used.filter((name) => !font.includes(name));
  expect(missing, `not ligatures in material-icons-round.woff2: ${missing.join(", ")}`).toEqual([]);
});

test("the outlined font carries the same names, since menus swap between them", () => {
  const outlined = ligatureText("material-icons-outlined.woff2");
  const used = [...new Set([...usedIconNames(), ...boundIconNames()])];

  const missing = used.filter((name) => !outlined.includes(name));
  expect(missing, `not ligatures in material-icons-outlined.woff2: ${missing.join(", ")}`).toEqual(
    [],
  );
});

test("Framework7 icon names do not resolve as Material names", () => {
  const font = ligatureText("material-icons-round.woff2");

  // The app was Framework7-iconed before it went Material-only. Each of these would render as its
  // own literal text if it survived a copy-paste. Only names this font genuinely lacks are listed:
  // matching is by substring, so `trash`, `plus` and `chevron_left` all "resolve" here - the first
  // two by coincidence inside longer names, and `chevron_left` because Material really has it.
  for (const framework7Name of [
    "paintbrush_fill",
    "exclamationmark_triangle_fill",
    "square_grid_2x2_fill",
    "arrow_2_circlepath",
    "checkmark_seal_fill",
    "xmark",
    "scope",
    "viewfinder",
    "cart_fill",
    "bell_fill",
    "doc_plaintext",
    "slider_horizontal_3",
    "eyedropper_full",
  ]) {
    expect(font.includes(framework7Name), `${framework7Name} should not resolve`).toBe(false);
  }
});

test("no Framework7 icon prop survives in the source", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(join(import.meta.dirname, "..", "src"))) {
    const source = readFileSync(file, "utf8");
    if (/\b(?:icon-)?f7="|:f7="|\bios="|icon-ios=/.test(source)) offenders.push(file);
  }
  expect(
    offenders,
    `Material-only app; drop the iOS icon props in: ${offenders.join(", ")}`,
  ).toEqual([]);
});
