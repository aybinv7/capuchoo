import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * An optional peer must be invisible to a bundler.
 *
 * `import("@capacitor/network")` written as a literal is statically analysable,
 * and Rolldown fails the *build* of any app that has not installed it:
 *
 *   Rolldown failed to resolve import "@capacitor/local-notifications"
 *   from ".../@capuchoo/updater/dist/vue.js"
 *
 * That defeats the point of an optional peer entirely - an OTA-only app would
 * have to install four native plugins it never calls, just to compile. It was
 * caught in a real app rather than here, because our own build has every plugin
 * installed and so resolves them all happily.
 *
 * Asserted on the source: the failure is a property of how the import is
 * written, and there is no way to observe it from inside this package.
 */
const SOURCE_DIR = import.meta.dirname;

const OPTIONAL_PACKAGES = [
  "@capacitor/file-transfer",
  "@capacitor/filesystem",
  "@capacitor/network",
  "@capawesome-team/capacitor-file-opener",
  "@capacitor/local-notifications",
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

/**
 * Comments are stripped first.
 *
 * The doc comment explaining this very bug contains `import("@capacitor/network")`
 * as an example, and without this the test flags the file that fixes the problem.
 * The same mistake was made once already today, in a migration test that parsed
 * the constraint quoted in its own header.
 */
function withoutComments(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*$/gm, "");
}

const sources = sourceFiles(SOURCE_DIR).map((file) => ({
  file: path.relative(SOURCE_DIR, file).replaceAll("\\", "/"),
  text: withoutComments(fs.readFileSync(file, "utf8")),
}));

describe("optional peers are never imported by literal", () => {
  it.each(OPTIONAL_PACKAGES)("%s is not statically importable", (pkg) => {
    // `import("pkg")` and `from "pkg"` both resolve at build time. A type-only
    // `typeof import("pkg")` does not - it is erased before a bundler sees it.
    const offenders = sources
      .filter(({ text }) => {
        const dynamic = new RegExp(`(?<!typeof )import\\(\\s*["'\`]${pkg}["'\`]`).test(text);
        const stat1c = new RegExp(`from\\s+["'\`]${pkg}["'\`]`).test(text);
        return dynamic || stat1c;
      })
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("still names every optional package somewhere, so the list is real", () => {
    // Guards the test itself: a rename that removed all mentions would make the
    // assertions above pass vacuously.
    const all = sources.map((s) => s.text).join("\n");

    for (const pkg of OPTIONAL_PACKAGES) {
      expect(all, pkg).toContain(pkg);
    }
  });

  it("imports them through a variable specifier instead", () => {
    // Read raw, not through `sources`: the marker is itself a comment, and that
    // is exactly what the stripping above throws away.
    const raw = sourceFiles(SOURCE_DIR)
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(raw).toContain("@vite-ignore");
  });
});
