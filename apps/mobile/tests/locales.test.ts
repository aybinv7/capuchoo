import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vite-plus/test";

const SRC = join(import.meta.dirname, "..", "src");
const LOCALES = ["en", "fr"] as const;

type Messages = { [key: string]: string | Messages };

function load(code: string): Messages {
  return JSON.parse(readFileSync(join(SRC, "locales", `${code}.json`), "utf8")) as Messages;
}

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [inner, text] of flatten(value, path)) out.set(inner, text);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const branches = (text: string) => text.split("|").length;

/**
 * A key missing from one locale renders as its own dotted path on screen, and vue-i18n says nothing.
 * French falls back to English silently, which reads as "translated" in review and is not.
 */
test("every locale has exactly the same keys", () => {
  const reference = flatten(load("en"));
  for (const code of LOCALES) {
    const keys = flatten(load(code));
    const missing = [...reference.keys()].filter((key) => !keys.has(key));
    const extra = [...keys.keys()].filter((key) => !reference.has(key));
    expect({ code, missing, extra }).toEqual({ code, missing: [], extra: [] });
  }
});

/**
 * A translation that drops `{count}` shows a sentence with no number in it; one that drops a `|`
 * branch picks the wrong plural. Both compile and both are wrong.
 */
test("translations keep the placeholders and plural branches of the English", () => {
  const reference = flatten(load("en"));
  const problems: string[] = [];
  for (const code of LOCALES) {
    for (const [key, text] of flatten(load(code))) {
      const source = reference.get(key);
      if (source === undefined) continue;
      if (placeholders(text).join() !== placeholders(source).join()) {
        problems.push(
          `${code}.${key}: placeholders ${placeholders(text).join()} ≠ ${placeholders(source).join()}`,
        );
      }
      if (branches(text) !== branches(source)) {
        problems.push(
          `${code}.${key}: ${branches(text)} plural branches, English has ${branches(source)}`,
        );
      }
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(vue|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/** A literal key passed to `t()` that no locale defines renders as its own dotted path. */
test("every literal key the source asks for exists", () => {
  const keys = flatten(load("en"));
  const missing: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\bt\(\s*["']([a-zA-Z][\w.]*)["']/g)) {
      const key = match[1]!;
      if (!keys.has(key)) missing.push(`${relative(SRC, file)}: ${key}`);
    }
  }
  expect(missing, missing.join("\n")).toEqual([]);
});
