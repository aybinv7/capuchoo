import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCapacitor, tokenize, type StepContext } from "./build.js";

describe("tokenize", () => {
  it("splits on whitespace", () => {
    expect(tokenize("vite build --mode staging")).toEqual(["vite", "build", "--mode", "staging"]);
  });

  it("keeps a quoted path with spaces as one argument", () => {
    // This is the case that made the old shell-string approach wrong: a path
    // under "Program Files" became two arguments.
    expect(tokenize('node "C:/Program Files/tool/run.js" --flag')).toEqual([
      "node",
      "C:/Program Files/tool/run.js",
      "--flag",
    ]);
  });

  it("handles single quotes", () => {
    expect(tokenize("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  it("collapses repeated whitespace", () => {
    expect(tokenize("  vite   build  ")).toEqual(["vite", "build"]);
  });

  it("rejects an unbalanced quote instead of silently truncating", () => {
    expect(() => tokenize('node "unterminated')).toThrow(/Unbalanced/);
  });

  it("returns an empty list for an empty command", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("syncCapacitor", () => {
  const context = (appDir: string) =>
    ({
      toolchain: { appDir },
      flavour: {},
      env: {},
      runOptions: {},
    }) as unknown as StepContext;

  it("skips an OTA deploy in a checkout without the native project", async () => {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-sync-"));
    const outcome = await syncCapacitor(context(appDir), "android", {
      dir: "android",
      required: false,
    });
    expect(outcome).toEqual({
      ran: false,
      reason: "no android/ project, and an OTA bundle does not need one",
    });
  });

  it("still tries when a native deploy needs the project", async () => {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-sync-"));
    const outcome = await syncCapacitor(context(appDir), "android", {
      dir: "android",
      required: true,
    });
    expect(outcome).toEqual({ ran: false, reason: "@capacitor/cli is not installed" });
  });
});
