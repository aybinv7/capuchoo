import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

/**
 * A Framework7 tag the resolver does not list is left as an unknown element: no import, no error,
 * an empty box on screen. The dashboard's gauge and charts shipped invisible exactly this way.
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

test("every Framework7 tag used in a template is one the resolver imports", () => {
  const resolver = readFileSync(join(SRC, "shared", "utils", "resolvers", "resolvers.ts"), "utf8");
  const listed = new Set([...resolver.matchAll(/"(f7-[a-z-]+)"/g)].map((match) => match[1]));

  const missing = new Set<string>();
  for (const file of vueFiles(SRC)) {
    const template = readFileSync(file, "utf8").split("<script")[0] ?? "";
    for (const match of template.matchAll(/<F7([A-Za-z]+)/g)) {
      const kebab = `f7-${match[1]!.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
      if (!listed.has(kebab)) missing.add(kebab);
    }
  }
  expect([...missing], "add these to framework7Components in resolvers.ts").toEqual([]);
});
