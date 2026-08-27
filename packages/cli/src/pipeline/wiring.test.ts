import { describe, expect, it } from "vite-plus/test";
import { patchCapacitorConfig, patchEntryFile, patchEnvFile, describePatch } from "./wiring.js";

const API = "https://capuchoo-back.onrender.com";

/** Lowmaro's real prod flavour, which is what every run so far tripped over. */
const ENV_FILE = `# Production build
VITE_APP_ID=com.ayb.lowmaro
VITE_APP_NAME=Lowmaro
VITE_APP_VERSION=1.0.0

VERSION_CODE=1

VITE_API_URL=
VITE_ENVIRONMENT=prod
VITE_ENABLE_HARNESS=false

ENABLE_LOGGING=false
`;

describe("patchEnvFile", () => {
  it("adds both variables after VITE_ENVIRONMENT", () => {
    const patch = patchEnvFile(ENV_FILE, API, "prod");

    expect(patch.content).toContain(`VITE_UPDATE_API_URL=${API}`);
    expect(patch.content).toContain("VITE_UPDATE_CHANNEL=prod");
    expect(patch.summary).toBe("+2 lines");

    // Grouped with the flavour's own settings rather than dropped at the end.
    const lines = patch.content!.split("\n");
    expect(lines.indexOf("VITE_UPDATE_API_URL=" + API)).toBeGreaterThan(
      lines.indexOf("VITE_ENVIRONMENT=prod"),
    );
    expect(lines.indexOf("VITE_UPDATE_API_URL=" + API)).toBeLessThan(
      lines.indexOf("ENABLE_LOGGING=false"),
    );
  });

  it("keeps every line the file already had", () => {
    const patch = patchEnvFile(ENV_FILE, API, "prod");

    for (const line of ENV_FILE.split("\n").filter((l) => l.trim())) {
      expect(patch.content).toContain(line);
    }
  });

  it("does nothing when both are already set", () => {
    const already = `${ENV_FILE}VITE_UPDATE_API_URL=${API}\nVITE_UPDATE_CHANNEL=prod\n`;
    const patch = patchEnvFile(already, API, "prod");

    expect(patch.content).toBeNull();
    expect(patch.conflict).toBeUndefined();
  });

  it("adds only the one that is missing", () => {
    const half = `${ENV_FILE}VITE_UPDATE_API_URL=${API}\n`;
    const patch = patchEnvFile(half, API, "prod");

    expect(patch.summary).toBe("+1 line");
    expect(patch.content).toContain("VITE_UPDATE_CHANNEL=prod");
  });

  /**
   * The case that was live: Lowmaro named the pre-rename `capucho-back` host,
   * one letter short and answering 404. Rewriting an operator's endpoint without
   * saying so is a surprise, not a fix.
   */
  it("reports a different existing value instead of overwriting it", () => {
    const stale = `${ENV_FILE}VITE_UPDATE_API_URL=https://capucho-back.onrender.com\n`;
    const patch = patchEnvFile(stale, API, "prod");

    expect(patch.content).not.toContain(`VITE_UPDATE_API_URL=${API}`);
    expect(patch.content).toContain("https://capucho-back.onrender.com");
    expect(patch.conflict).toContain("VITE_UPDATE_API_URL is already");
  });

  it("appends when there is no VITE_ENVIRONMENT to anchor to", () => {
    const patch = patchEnvFile("FOO=bar\n", API, "dev");

    expect(patch.content).toContain("FOO=bar");
    expect(patch.content).toContain("VITE_UPDATE_CHANNEL=dev");
  });
});

/** Lowmaro's real entry file. */
const ENTRY = `import { createApp } from "vue";
import Framework7 from "framework7/lite-bundle";
import App from "./App.vue";
import { sqlitePlugin } from "./plugins/sqlite.plugin";

Framework7.use(Framework7Vue);

await sqlitePlugin();
createApp(App).mount("#app");
`;

describe("patchEntryFile", () => {
  it("imports and calls notifyAppReady", () => {
    const patch = patchEntryFile(ENTRY);

    expect(patch.content).toContain('import { notifyAppReady } from "@capuchoo/updater";');
    expect(patch.content).toContain("void notifyAppReady();");
  });

  /**
   * The placement is the whole point. Behind the `await sqlitePlugin()` the call
   * can miss the plugin's window, and the plugin then rolls back to the previous
   * bundle - an update that installs and silently reverts.
   */
  it("calls it before the first statement, not after the await", () => {
    const lines = patchEntryFile(ENTRY).content!.split("\n");

    expect(lines.indexOf("void notifyAppReady();")).toBeLessThan(
      lines.findIndex((line) => line.includes("await sqlitePlugin()")),
    );
    expect(lines.indexOf("void notifyAppReady();")).toBeGreaterThan(
      lines.findIndex((line) => line.includes('from "./plugins/sqlite.plugin"')),
    );
  });

  it("keeps every import the file had", () => {
    const patch = patchEntryFile(ENTRY);

    for (const line of ENTRY.split("\n").filter((l) => l.startsWith("import"))) {
      expect(patch.content).toContain(line);
    }
  });

  it("does nothing when it is already called", () => {
    expect(patchEntryFile(`void notifyAppReady();\n${ENTRY}`).content).toBeNull();
  });

  it("handles a file with no imports", () => {
    const patch = patchEntryFile('console.log("hi");\n');

    expect(patch.content).toContain("notifyAppReady");
    expect(patch.content).toContain('console.log("hi");');
  });

  it("survives a multi-line import", () => {
    const multi = `import {
  createApp,
} from "vue";

createApp();
`;
    const lines = patchEntryFile(multi).content!.split("\n");

    expect(lines.indexOf("void notifyAppReady();")).toBeGreaterThan(
      lines.findIndex((line) => line.includes('} from "vue"')),
    );
  });
});

/** Lowmaro's real config, trimmed. */
const CONFIG = `import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: process.env.VITE_APP_ID ?? "com.ayb.lowmaro",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    Keyboard: {
      resize: KeyboardResize.Native,
    },
  },
};

export default config;
`;

describe("patchCapacitorConfig", () => {
  it("inserts the helper into the existing plugins block", () => {
    const patch = patchCapacitorConfig(CONFIG);

    expect(patch.content).toContain(
      'import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";',
    );
    expect(patch.content).toContain("CapacitorUpdater: capuchooUpdaterConfig({");
    expect(patch.content).toContain("apiUrl: process.env.VITE_UPDATE_API_URL");
    expect(patch.content).toContain("channel: process.env.VITE_UPDATE_CHANNEL");
  });

  it("leaves the plugins that were already there", () => {
    const patch = patchCapacitorConfig(CONFIG);

    expect(patch.content).toContain("SplashScreen: {");
    expect(patch.content).toContain("resize: KeyboardResize.Native,");
  });

  it("indents the entry to match its siblings", () => {
    const patch = patchCapacitorConfig(CONFIG);

    expect(patch.content).toContain("    CapacitorUpdater: capuchooUpdaterConfig({");
  });

  it("does nothing when the helper is already used", () => {
    expect(patchCapacitorConfig(`x capuchooUpdaterConfig y`).content).toBeNull();
  });

  /**
   * Both refusals are deliberate. Rewriting a hand-written block, or inventing a
   * plugins key in a config shape this has not seen, needs a judgement about the
   * surrounding code that a regex cannot make.
   */
  it("refuses to rewrite a hand-written CapacitorUpdater block", () => {
    const hand = CONFIG.replace(
      "SplashScreen: {",
      'CapacitorUpdater: {\n      updateUrl: "",\n    },\n    SplashScreen: {',
    );
    const patch = patchCapacitorConfig(hand);

    expect(patch.content).toBeNull();
    expect(patch.manual).toContain("capuchooUpdaterConfig");
  });

  it("refuses when there is no plugins block", () => {
    const patch = patchCapacitorConfig(`const config = { appId: "x" };\n`);

    expect(patch.content).toBeNull();
    expect(patch.manual).toContain("plugins: {");
  });
});

describe("describePatch", () => {
  it("shows only the added lines", () => {
    const diff = describePatch("main.ts", ENTRY, patchEntryFile(ENTRY).content!);

    expect(diff).toContain("main.ts");
    expect(diff).toContain("+ void notifyAppReady();");
    expect(diff).not.toContain("+ createApp(App).mount");
  });
});
