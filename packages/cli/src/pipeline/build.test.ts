import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  assetPathArgument,
  countGeneratedAssets,
  syncCapacitor,
  tokenize,
  type StepContext,
} from "./build.js";

describe("assetPathArgument", () => {
  const appDir = path.resolve("app");

  it("passes the asset directory relative to the app, with forward slashes", () => {
    expect(assetPathArgument(appDir, path.join(appDir, "build", "dev", "assets"))).toBe(
      "build/dev/assets",
    );
  });

  it("never passes an absolute path, which @capacitor/assets appends to the project root", () => {
    const argument = assetPathArgument(appDir, path.join(appDir, "build", "dev", "assets"));
    expect(path.isAbsolute(argument)).toBe(false);
    expect(path.join(appDir, argument)).toBe(path.join(appDir, "build", "dev", "assets"));
  });

  it("reaches an asset directory outside the app", () => {
    expect(assetPathArgument(appDir, path.resolve("shared", "assets"))).toBe("../shared/assets");
  });

  it("uses . when the asset directory is the app itself", () => {
    expect(assetPathArgument(appDir, appDir)).toBe(".");
  });

  it.runIf(process.platform === "win32")("rejects an asset directory on another drive", () => {
    const otherDrive = appDir.toUpperCase().startsWith("Z:") ? "Y:assets" : "Z:assets";
    expect(() => assetPathArgument(appDir, otherDrive)).toThrow(/different drive/);
  });
});

describe("countGeneratedAssets", () => {
  it("counts the CREATE lines, ignoring colour codes", () => {
    const stdout = [
      "Generating assets for \x1b[32mandroid\x1b[39m",
      "\x1b[1m\x1b[32mCREATE\x1b[39m\x1b[22m \x1b[1mandroid\x1b[22m icon drawable-ldpi-icon.png (1.2 KB)",
      "CREATE android adaptive-icon mipmap-mdpi/ic_launcher_foreground.png (3.4 KB)",
      "",
      "Totals:",
    ].join("\n");

    expect(countGeneratedAssets({ code: 0, stdout, stderr: "" })).toBe(2);
  });

  it("reports nothing generated when the tool logs an error and exits 0", () => {
    const stderr =
      "Asset directory not found at C:app. Use --asset-path to specify a specific directory containing assets";

    expect(countGeneratedAssets({ code: 0, stdout: "", stderr })).toBe(0);
  });
});

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
