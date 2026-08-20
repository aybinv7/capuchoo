import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { collectAndroidArtifact, findApk, isApkSigned } from "./android.js";
import { createBundleZip } from "./zip.js";

/**
 * The signature check is the safety net that stops the CLI publishing an
 * unsigned release APK - which Gradle produces happily when the project has no
 * signingConfig, and which Android then refuses to install.
 */

let workDir: string;

function makeApk(relative: string, extraEntry?: { name: string; body: string }): string {
  const stage = path.join(workDir, "stage", relative.replaceAll("/", "_"));
  fs.mkdirSync(stage, { recursive: true });
  fs.writeFileSync(path.join(stage, "index.html"), "<html></html>");
  fs.writeFileSync(path.join(stage, "AndroidManifest.xml"), "<manifest/>");
  if (extraEntry) {
    const file = path.join(stage, extraEntry.name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, extraEntry.body);
  }

  const apk = path.join(workDir, relative);
  createBundleZip({ webDir: stage, outFile: apk });
  return apk;
}

function variantDir(buildType: string): string {
  return path.join(workDir, "app", "build", "outputs", "apk", buildType);
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "capucho-apk-"));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe("isApkSigned", () => {
  it("detects a v1 JAR signature in META-INF", () => {
    const apk = makeApk("app/build/outputs/apk/release/app-release.apk", {
      name: "META-INF/CERT.RSA",
      body: "certificate bytes",
    });
    expect(isApkSigned(apk)).toBe(true);
  });

  it("detects a v2 signing block", () => {
    const apk = makeApk("signed-v2.apk");
    // The v2 block sits before the central directory and ends with this magic.
    fs.appendFileSync(apk, "APK Sig Block 42");
    expect(isApkSigned(apk)).toBe(true);
  });

  it("reports an unsigned APK as unsigned", () => {
    const apk = makeApk("app/build/outputs/apk/release/app-release-unsigned.apk");
    expect(isApkSigned(apk)).toBe(false);
  });

  it("does not mistake an unrelated META-INF entry for a signature", () => {
    const apk = makeApk("plain.apk", {
      name: "META-INF/MANIFEST.MF",
      body: "Manifest-Version: 1.0",
    });
    expect(isApkSigned(apk)).toBe(false);
  });
});

describe("findApk", () => {
  it("returns null when the variant was never built", () => {
    expect(findApk(workDir, "release")).toBeNull();
  });

  it("finds an APK nested under the variant directory", () => {
    makeApk("app/build/outputs/apk/release/app-release.apk");
    expect(findApk(workDir, "release")).toContain("app-release.apk");
  });

  it("ignores instrumentation test APKs", () => {
    fs.mkdirSync(variantDir("release"), { recursive: true });
    makeApk("app/build/outputs/apk/release/app-androidTest.apk");
    expect(findApk(workDir, "release")).toBeNull();
  });
});

describe("collectAndroidArtifact", () => {
  it("refuses an unsigned release build", () => {
    // The old findApk accepted this file and uploaded it as a release.
    makeApk("app/build/outputs/apk/release/app-release-unsigned.apk");

    expect(() => collectAndroidArtifact(workDir, "release", false)).toThrow(/is not signed/);
  });

  it("allows an unsigned release when asked explicitly", () => {
    makeApk("app/build/outputs/apk/release/app-release-unsigned.apk");

    const result = collectAndroidArtifact(workDir, "release", true);
    expect(result.signed).toBe(false);
    expect(result.byteSize).toBeGreaterThan(0);
  });

  it("does not require a signature for a debug build", () => {
    // Gradle signs debug builds with the shared debug keystore, but a stripped
    // CI image may not have it, and a debug artefact is not a release anyway.
    makeApk("app/build/outputs/apk/debug/app-debug.apk");

    expect(() => collectAndroidArtifact(workDir, "debug", false)).not.toThrow();
  });

  it("accepts a signed release", () => {
    makeApk("app/build/outputs/apk/release/app-release.apk", {
      name: "META-INF/CERT.RSA",
      body: "certificate bytes",
    });

    const result = collectAndroidArtifact(workDir, "release", false);
    expect(result.signed).toBe(true);
  });

  it("explains that Gradle succeeded but produced nothing", () => {
    fs.mkdirSync(variantDir("release"), { recursive: true });

    expect(() => collectAndroidArtifact(workDir, "release", false)).toThrow(
      /no release APK exists/,
    );
  });
});
