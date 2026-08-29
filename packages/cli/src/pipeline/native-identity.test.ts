import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * The version has to reach the APK, whichever native-config path runs.
 *
 * Trapeze and the built-in patcher were alternatives, and only the built-in one
 * writes applicationId, versionName and versionCode into build.gradle. So a
 * Trapeze config that declared nothing but a permission - which is exactly what
 * a config added to fix the APK-install permission looks like - meant the
 * version was never applied.
 *
 * Observed, not theorised: a release published as v0.3.0 / code 5 produced an
 * APK containing 0.2.1 / code 4.
 *
 *   $ adb shell dumpsys package com.ayb.capuchootestbed
 *       versionCode=4  versionName=0.2.1
 *
 * That does not merely mislabel a file. A device reports the version compiled
 * into it, so it installs the update, goes on reporting the older code, is
 * offered the same release again, and loops - an update that can never converge.
 *
 * Asserted on the source because the alternative is a gradle build per case.
 */
const source = fs.readFileSync(path.join(import.meta.dirname, "native-config.ts"), "utf8");

describe("native identity survives the Trapeze path", () => {
  it("runs the built-in patcher before handing over to Trapeze", () => {
    const builtin = source.indexOf("const builtin = applyBuiltinConfig(input)");
    const trapeze = source.indexOf('run(trapezeBin, ["run"');

    expect(builtin, "applyBuiltinConfig is not called on the Trapeze path").toBeGreaterThan(-1);
    expect(trapeze).toBeGreaterThan(-1);
    expect(builtin).toBeLessThan(trapeze);
  });

  it("does not return before the built-in patcher has run", () => {
    // The original bug in one line: an early return that skipped identity.
    const guard = source.indexOf("if (trapezeBin && input.flavour.trapezeConfig)");
    const builtin = source.indexOf("const builtin = applyBuiltinConfig(input)");
    const earlyReturn = source.indexOf('return { method: "trapeze"');

    expect(guard).toBeLessThan(builtin);
    expect(builtin).toBeLessThan(earlyReturn);
  });

  it("reports what the built-in step changed, not an empty list", () => {
    // `changed: []` was the tell that identity had been dropped on this path.
    expect(source).toContain("changed: builtin.changed");
    expect(source).not.toContain('return { method: "trapeze", changed: [],');
  });

  it("still writes all four identity values", () => {
    for (const key of ["applicationId", "versionName", "versionCode", "namespace"]) {
      expect(source, key).toContain(key);
    }
  });
});
