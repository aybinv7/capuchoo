import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { restoreVersionFiles, snapshotVersionFiles } from "./version-guard.js";

/**
 * A throwaway app directory, so this exercises the real filesystem rather than a
 * mock of it - the whole point is what is left on disk after a failure.
 */
function tempApp(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-guard-"));

  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content, "utf8");
  }

  return dir;
}

const PKG = (version: string) => `{\n  "name": "app",\n  "version": "${version}"\n}\n`;
const CODES = `{\n  "dev": 1,\n  "staging": 6,\n  "prod": 1\n}\n`;

describe("snapshotVersionFiles", () => {
  it("captures every tracked file a deploy may rewrite", () => {
    const dir = tempApp({ "package.json": PKG("5.0.0"), "version-code.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    // build.gradle and strings.xml are written by the native configuration step,
    // and were left behind claiming a release that was never published.
    expect(snapshots.map((s) => path.basename(s.file))).toEqual([
      "package.json",
      "version-code.json",
      "build.gradle",
      "strings.xml",
    ]);
    expect(snapshots[0]!.content).toContain('"version": "5.0.0"');
    expect(snapshots[1]!.content).toContain('"staging": 6');
  });

  it("records a file that does not exist as null, not as empty", () => {
    // Empty and absent restore differently: one is a write, the other a delete.
    const dir = tempApp({ "package.json": PKG("1.0.0") });

    expect(snapshotVersionFiles(dir, "version-code.json")[1]!.content).toBeNull();
  });

  it("follows the project's own versionCodeFile path", () => {
    const dir = tempApp({ "package.json": PKG("1.0.0"), "build/codes.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "build/codes.json");

    expect(snapshots[1]!.content).toContain('"staging": 6');
  });
});

describe("restoreVersionFiles", () => {
  /**
   * The failure this exists for. Validation passed, the version was written, and
   * the *build* failed at step 3 of 7 - so moving validation earlier did nothing
   * for it. Lowmaro went 6.0.0 -> 7.0.0 with nothing published, and the CLI
   * printed "revert it with git checkout" instead of reverting it.
   */
  it("puts the version back after a failure that came later than validation", () => {
    const dir = tempApp({ "package.json": PKG("6.0.0"), "version-code.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    fs.writeFileSync(path.join(dir, "package.json"), PKG("7.0.0"), "utf8");

    expect(restoreVersionFiles(snapshots)).toEqual(["package.json"]);
    expect(fs.readFileSync(path.join(dir, "package.json"), "utf8")).toContain('"version": "6.0.0"');
  });

  it("puts the build numbers back too", () => {
    const dir = tempApp({ "package.json": PKG("6.0.0"), "version-code.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    fs.writeFileSync(path.join(dir, "version-code.json"), `{"dev":8,"staging":8,"prod":8}`, "utf8");

    expect(restoreVersionFiles(snapshots)).toEqual(["version-code.json"]);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "version-code.json"), "utf8"))).toEqual({
      dev: 1,
      staging: 6,
      prod: 1,
    });
  });

  it("restores both when both moved", () => {
    const dir = tempApp({ "package.json": PKG("6.0.0"), "version-code.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    fs.writeFileSync(path.join(dir, "package.json"), PKG("7.0.0"), "utf8");
    fs.writeFileSync(path.join(dir, "version-code.json"), `{"prod":9}`, "utf8");

    expect(restoreVersionFiles(snapshots).sort()).toEqual(["package.json", "version-code.json"]);
  });

  it("reports nothing and touches nothing when the deploy changed nothing", () => {
    const dir = tempApp({ "package.json": PKG("6.0.0"), "version-code.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");
    const before = fs.statSync(path.join(dir, "package.json")).mtimeMs;

    expect(restoreVersionFiles(snapshots)).toEqual([]);
    expect(fs.statSync(path.join(dir, "package.json")).mtimeMs).toBe(before);
  });

  it("deletes a file the deploy created", () => {
    const dir = tempApp({ "package.json": PKG("1.0.0") });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    fs.writeFileSync(path.join(dir, "version-code.json"), CODES, "utf8");

    expect(restoreVersionFiles(snapshots)).toEqual(["version-code.json"]);
    expect(fs.existsSync(path.join(dir, "version-code.json"))).toBe(false);
  });

  it("is idempotent", () => {
    const dir = tempApp({ "package.json": PKG("6.0.0"), "version-code.json": CODES });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    fs.writeFileSync(path.join(dir, "package.json"), PKG("7.0.0"), "utf8");

    expect(restoreVersionFiles(snapshots)).toEqual(["package.json"]);
    expect(restoreVersionFiles(snapshots)).toEqual([]);
  });
});

describe("the deploy wires it to the published/not-published fork", () => {
  const execute = fs.readFileSync(path.join(import.meta.dirname, "execute.ts"), "utf8");

  it("snapshots before writing the version", () => {
    const snapshot = execute.indexOf("snapshotVersionFiles(");
    const write = execute.indexOf("writeAppVersion(appDir, version)");

    expect(snapshot).toBeGreaterThan(-1);
    expect(snapshot).toBeLessThan(write);
  });

  it("restores only when nothing was published", () => {
    // Restoring after a successful upload would rewind past a version that
    // exists on the server, and the next deploy would publish it again.
    expect(execute).toContain("if (uploaded)");
    expect(execute).toContain("restoreVersionFiles(versionFiles)");
  });

  it("no longer asks the operator to run git checkout", () => {
    expect(execute).not.toContain("git checkout -- ");
  });
});

/**
 * Observed on a real failed deploy: the upload could not reach the backend, the
 * guard restored package.json and version-code.json, and build.gradle was left
 * reading `versionCode 8 / versionName "0.5.1"` for a version that does not
 * exist. The next deploy rewrites it, so it is less damaging than the
 * package.json bump - but it is the same defect and deserves the same fix.
 */
describe("the native identity files are restored too", () => {
  const GRADLE = (code: number, name: string) =>
    `android {
  defaultConfig {
    versionCode ${code}
    versionName "${name}"
  }
}
`;

  it("puts build.gradle back after a failed deploy", () => {
    const dir = tempApp({
      "package.json": PKG("5.0.0"),
      "version-code.json": CODES,
      "android/app/build.gradle": GRADLE(6, "0.4.0"),
    });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    fs.writeFileSync(path.join(dir, "android/app/build.gradle"), GRADLE(8, "0.5.1"), "utf8");

    expect(restoreVersionFiles(snapshots)).toEqual(["build.gradle"]);
    expect(fs.readFileSync(path.join(dir, "android/app/build.gradle"), "utf8")).toContain(
      'versionName "0.4.0"',
    );
  });

  it("follows the project's own androidDir", () => {
    const dir = tempApp({
      "package.json": PKG("1.0.0"),
      "native/app/build.gradle": GRADLE(1, "1.0.0"),
    });
    const snapshots = snapshotVersionFiles(dir, "version-code.json", "native");

    expect(snapshots.some((s) => s.file.includes("native"))).toBe(true);
  });

  it("says nothing about an app with no android project", () => {
    const dir = tempApp({ "package.json": PKG("1.0.0") });
    const snapshots = snapshotVersionFiles(dir, "version-code.json");

    // Absent files snapshot as null and restore to nothing, so an iOS-only or
    // web-only app is unaffected.
    expect(restoreVersionFiles(snapshots)).toEqual([]);
  });
});
