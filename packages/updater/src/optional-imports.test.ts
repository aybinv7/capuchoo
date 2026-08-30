import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * An optional peer must be invisible to a bundler *and* reachable at run time.
 *
 * Two attempts failed on a real device, in opposite directions:
 *
 *  1. `import("@capacitor/network")` as a literal is statically analysable, so
 *     Rolldown failed the *build* of any app that had not installed it:
 *
 *       Rolldown failed to resolve import "@capacitor/local-notifications"
 *       from ".../@capuchoo/updater/dist/vue.js"
 *
 *  2. The same import through a variable with `@vite-ignore` hides it from the
 *     bundler - and hiding it from the bundler hides it from module resolution.
 *     The bare specifier reached the browser, which maps no bare names:
 *
 *       TypeError: Failed to resolve module specifier '@capacitor/network'
 *
 *     Every native download died there, reporting "@capacitor/network is not
 *     installed" about a plugin that was installed and synced.
 *
 * `registerPlugin` resolves nothing: it is a proxy keyed by the plugin's
 * registered name, and the native half is found by that name. Nothing to fail
 * on at build time, nothing to look up at run time.
 *
 * Asserted on the source, because neither failure is observable from inside
 * this package - our own build has every plugin installed, and there is no
 * bundler or WebView here.
 */
const SOURCE_DIR = import.meta.dirname;

const OPTIONAL_PACKAGES = [
  "@capacitor/file-transfer",
  "@capacitor/filesystem",
  "@capacitor/network",
  "@capawesome-team/capacitor-file-opener",
  "@capacitor/local-notifications",
];

/** The name each plugin registers natively, which is not its package name. */
const REGISTERED_NAMES = [
  "FileTransfer",
  "Filesystem",
  "Network",
  "FileOpener",
  "LocalNotifications",
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
 * The doc comments explaining these bugs quote the offending imports verbatim,
 * and without this the test flags the files that fix the problem.
 */
function withoutComments(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*$/gm, "");
}

const sources = sourceFiles(SOURCE_DIR).map((file) => ({
  file: path.relative(SOURCE_DIR, file).replaceAll("\\", "/"),
  text: withoutComments(fs.readFileSync(file, "utf8")),
}));

const code = sources.map((source) => source.text).join("\n");

describe("optional peers are never imported", () => {
  it.each(OPTIONAL_PACKAGES)("%s is not imported for its value", (pkg) => {
    // A type-only `typeof import("pkg")` is fine - it is erased before either a
    // bundler or a browser sees it. Anything else is a resolution the app has
    // to satisfy.
    const offenders = sources
      .filter(({ text }) => {
        const dynamic = new RegExp(`(?<!typeof )import\\(\\s*["'\`]${pkg}["'\`]`).test(text);
        const stat1c = new RegExp(`from\\s+["'\`]${pkg}["'\`]`).test(text);
        return dynamic || stat1c;
      })
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("does not reach for a specifier held in a variable either", () => {
    // That was attempt 2, and it is worse than attempt 1: it moves the failure
    // from the developer's build to the user's device.
    expect(code).not.toContain("@vite-ignore");
  });
});

describe("they are reached through Capacitor's registry", () => {
  it("registers every one of them by name", () => {
    for (const name of REGISTERED_NAMES) {
      expect(code, name).toContain(`"${name}"`);
    }
  });

  it("asks the platform whether a plugin is there, rather than guessing", () => {
    // The old code inferred "not installed" from the text of an exception, so a
    // resolution failure and a genuinely absent plugin were indistinguishable -
    // which is exactly how a synced, installed plugin was reported as missing.
    expect(code).toContain("Capacitor.isPluginAvailable");
    expect(code).toContain("registerPlugin");
  });

  it("still names every package in the message that tells you to install it", () => {
    // Guards the guidance: the names above are registry keys, and a developer
    // needs the npm package to install.
    //
    // `@capacitor/local-notifications` is deliberately not in this list. It is
    // not needed to *perform* a native update - only to draw a progress
    // notification while one downloads - so naming it in "native updates need
    // X" would be untrue. The CLI installs it with the rest; the runtime treats
    // its absence as "no notification" and carries on.
    const required = OPTIONAL_PACKAGES.filter((pkg) => pkg !== "@capacitor/local-notifications");

    for (const pkg of required) {
      expect(code, pkg).toContain(pkg);
    }
  });
});
