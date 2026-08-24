import { describe, expect, it } from "vite-plus/test";
import {
  RUNTIME_VERSION,
  detectCapacitor,
  installSpec,
  isSupportedMajor,
  majorFromRange,
  nativePackages,
  runtimePackages,
} from "./capacitor-support.js";

describe("majorFromRange", () => {
  it.each([
    ["^7.4.4", 7],
    ["~8.0.1", 8],
    [">=7.0.0 <9.0.0", 7],
    ["8.5.0", 8],
    ["^10.0.0", 10],
  ])("reads %s as major %i", (range, expected) => {
    expect(majorFromRange(range)).toBe(expected);
  });

  it.each([undefined, "", "latest", "workspace:^"])("gives up on %s", (range) => {
    expect(majorFromRange(range as string | undefined)).toBeNull();
  });
});

describe("detectCapacitor", () => {
  it("prefers dependencies, where a Capacitor app declares core", () => {
    expect(
      detectCapacitor({
        dependencies: { "@capacitor/core": "^7.4.4" },
        devDependencies: { "@capacitor/core": "^8.0.0" },
      }),
    ).toEqual({ major: 7, source: "dependencies" });
  });

  it("falls back to devDependencies", () => {
    expect(detectCapacitor({ devDependencies: { "@capacitor/core": "^8.1.0" } })).toEqual({
      major: 8,
      source: "devDependencies",
    });
  });

  it("reports nothing for an app that is not Capacitor at all", () => {
    expect(detectCapacitor({ dependencies: { vue: "^3.5.0" } })).toEqual({
      major: null,
      source: null,
    });
  });
});

describe("isSupportedMajor", () => {
  it.each([7, 8])("supports %i", (major) => expect(isSupportedMajor(major)).toBe(true));

  // 9 exists on the registry already; installing it blind is how an app ends up
  // with plugins nobody has tested together.
  it.each([null, 5, 6, 9, 10])("refuses %s", (major) => {
    expect(isSupportedMajor(major as number | null)).toBe(false);
  });
});

describe("version selection", () => {
  it("pins the capgo plugin to the app's Capacitor major", () => {
    expect(runtimePackages(7).map(installSpec)).toEqual([
      `@capuchoo/updater@^${RUNTIME_VERSION}`,
      "@capgo/capacitor-updater@^7",
      "@capacitor/app@^7",
    ]);
    expect(runtimePackages(8).map(installSpec)).toContain("@capgo/capacitor-updater@^8");
  });

  // file-transfer does not follow Capacitor's numbering: 1.x peers >=7, 2.x >=8.
  it("picks the file-transfer line by peer range, not by matching major", () => {
    expect(nativePackages(7).map(installSpec)).toContain("@capacitor/file-transfer@^1");
    expect(nativePackages(8).map(installSpec)).toContain("@capacitor/file-transfer@^2");
  });

  // Bare would resolve to whatever the package manager thinks `latest` is, and
  // pnpm's cached metadata lags a fresh publish - that installed 0.2.0 hours
  // after 0.4.0 shipped, silently.
  it("pins the runtime to an explicit version, never bare", () => {
    const runtime = runtimePackages(8)[0]!;
    expect(runtime.name).toBe("@capuchoo/updater");
    expect(runtime.range).toBe(`^${RUNTIME_VERSION}`);
    expect(runtime.range).toMatch(/^\^\d+\.\d+\.\d+$/);
  });
});
