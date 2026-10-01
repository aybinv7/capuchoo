import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vite-plus/test";

/**
 * Framework7 gives every `button` `width: 100%` in an unlayered stylesheet, which beats any
 * Tailwind `size-*` or `w-*` on it. A sized button without `!` silently fills its row: a voice
 * note's play button pushed the waveform out of the bubble, and a sticker took the whole screen
 * width. Nothing in type-checking sees it, so this does.
 */
const SRC = join(import.meta.dirname, "..", "src");

function vueFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) vueFiles(full, out);
    else if (entry.endsWith(".vue")) out.push(full);
  }
  return out;
}

const BUTTON = /<button\b[^>]*?\sclass="([^"]*)"/gs;
const SIZED = /^(?:[a-z0-9-]+:)*(?:size|w)-(?!full\b|auto\b)[^\s!]+$/;

test("a sized <button> overrides Framework7's width with `!`", () => {
  const offenders: string[] = [];
  for (const file of vueFiles(SRC)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(BUTTON)) {
      for (const token of match[1]!.split(/\s+/)) {
        if (SIZED.test(token)) offenders.push(`${relative(SRC, file)}: ${token}`);
      }
    }
  }
  expect(offenders, "write the class with a trailing `!`").toEqual([]);
});
