import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bundleFileName, createBundleZip } from "./zip.js";

/**
 * The archive format is dictated by @capgo/capacitor-updater's Android unzip.
 * These tests pin the two rules that only fail on a real device: entry names
 * must be forward-slash separated, and index.html must sit at the archive root.
 */

let workDir: string;

function write(relative: string, contents: string): void {
  const file = path.join(workDir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

/** Reads entry names out of a zip's central directory. */
function entryNames(zipPath: string): string[] {
  const buffer = fs.readFileSync(zipPath);
  const names: string[] = [];
  const CENTRAL = 0x02_01_4b_50;

  for (let offset = 0; offset + 46 <= buffer.length; offset++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL) continue;
    const nameLength = buffer.readUInt16LE(offset + 28);
    names.push(buffer.toString("utf8", offset + 46, offset + 46 + nameLength));
  }

  return names;
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "capucho-zip-"));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe("createBundleZip", () => {
  it("writes nested entries with forward slashes on every platform", () => {
    // The Android unzip rejects any entry containing a backslash outright, so
    // a path.join-built name would produce an archive that installs nowhere.
    write("dist/index.html", "<html></html>");
    write("dist/assets/app.js", "console.log(1)");
    write("dist/assets/nested/deep/style.css", "body{}");

    const out = path.join(workDir, "bundle.zip");
    createBundleZip({ webDir: path.join(workDir, "dist"), outFile: out });

    const names = entryNames(out);
    expect(names).toContain("assets/nested/deep/style.css");
    expect(names.every((name) => !name.includes("\\"))).toBe(true);
  });

  it("puts index.html at the archive root, not inside a wrapper folder", () => {
    // With more than one root entry the plugin uses the directory as-is. A
    // single wrapping folder would send it down its flatten path instead.
    write("dist/index.html", "<html></html>");
    write("dist/assets/app.js", "x");

    const out = path.join(workDir, "bundle.zip");
    createBundleZip({ webDir: path.join(workDir, "dist"), outFile: out });

    expect(entryNames(out)).toContain("index.html");
    expect(entryNames(out).some((name) => name.startsWith("dist/"))).toBe(false);
  });

  it("refuses a web directory with no index.html", () => {
    write("dist/assets/app.js", "x");

    expect(() =>
      createBundleZip({
        webDir: path.join(workDir, "dist"),
        outFile: path.join(workDir, "bundle.zip"),
      }),
    ).toThrow(/no index\.html/);
  });

  it("refuses a missing web directory instead of writing an empty archive", () => {
    expect(() =>
      createBundleZip({
        webDir: path.join(workDir, "nope"),
        outFile: path.join(workDir, "bundle.zip"),
      }),
    ).toThrow(/does not exist/);
  });

  it("refuses an empty web directory", () => {
    fs.mkdirSync(path.join(workDir, "dist"));
    write("dist/index.html", "<html></html>");
    fs.rmSync(path.join(workDir, "dist", "index.html"));

    expect(() =>
      createBundleZip({
        webDir: path.join(workDir, "dist"),
        outFile: path.join(workDir, "bundle.zip"),
      }),
    ).toThrow();
  });

  it("skips junk files that should never reach a device", () => {
    write("dist/index.html", "<html></html>");
    write("dist/.DS_Store", "junk");
    write("dist/assets/Thumbs.db", "junk");

    const out = path.join(workDir, "bundle.zip");
    createBundleZip({ webDir: path.join(workDir, "dist"), outFile: out });

    const names = entryNames(out);
    expect(names).not.toContain(".DS_Store");
    expect(names).not.toContain("assets/Thumbs.db");
  });

  it("is byte-for-byte reproducible", () => {
    // A fixed timestamp means rebuilding an unchanged bundle produces an
    // identical archive, so a checksum change really is a content change.
    write("dist/index.html", "<html></html>");
    write("dist/assets/app.js", "console.log(1)");

    const first = path.join(workDir, "a.zip");
    const second = path.join(workDir, "b.zip");
    createBundleZip({ webDir: path.join(workDir, "dist"), outFile: first });
    createBundleZip({ webDir: path.join(workDir, "dist"), outFile: second });

    expect(fs.readFileSync(first).equals(fs.readFileSync(second))).toBe(true);
  });

  it("reports what it packaged", () => {
    write("dist/index.html", "<html></html>");
    write("dist/assets/app.js", "console.log(1)");

    const result = createBundleZip({
      webDir: path.join(workDir, "dist"),
      outFile: path.join(workDir, "bundle.zip"),
    });

    expect(result.fileCount).toBe(2);
    expect(result.byteSize).toBeGreaterThan(0);
    expect(fs.existsSync(result.zipPath)).toBe(true);
  });

  it("creates the output directory when it does not exist", () => {
    write("dist/index.html", "<html></html>");

    const out = path.join(workDir, "nested", "out", "bundle.zip");
    createBundleZip({ webDir: path.join(workDir, "dist"), outFile: out });

    expect(fs.existsSync(out)).toBe(true);
  });
});

describe("bundleFileName", () => {
  it("identifies the app and version, and stays filesystem safe", () => {
    expect(bundleFileName("com.ayb.lowmaro", "1.2.3")).toBe(
      "capucho-bundle-com.ayb.lowmaro-1.2.3.zip",
    );
  });

  it("replaces characters that are not safe in a file name", () => {
    expect(bundleFileName("com/ayb:app", "1.0.0-beta+1")).toBe(
      "capucho-bundle-com-ayb-app-1.0.0-beta-1.zip",
    );
  });
});
