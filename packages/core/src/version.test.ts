import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  compareVersions,
  nextVersionCode,
  parseVersion,
  versionEnv,
} from "./version.js";

describe("bumpVersion", () => {
  it("bumps each level and resets the ones below", () => {
    expect(bumpVersion("1.4.7", "patch")).toBe("1.4.8");
    expect(bumpVersion("1.4.7", "minor")).toBe("1.5.0");
    expect(bumpVersion("1.4.7", "major")).toBe("2.0.0");
  });

  it("drops prerelease and build metadata, like npm version does", () => {
    expect(bumpVersion("2.0.0-beta.1+sha", "patch")).toBe("2.0.1");
  });

  it("refuses a version it cannot parse instead of guessing", () => {
    expect(() => bumpVersion("v1.2", "patch")).toThrow(/not a semantic version/);
  });
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("3.1.4", "3.1.4")).toBe(0);
  });

  it("sorts a prerelease before its release", () => {
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBeLessThan(0);
  });

  it('treats the "builtin" sentinel as the oldest possible version', () => {
    // The app reports "builtin" until an OTA bundle has been applied. If this
    // did not sort oldest, a fresh install would never see the first update.
    expect(compareVersions("builtin", "0.0.1")).toBeLessThan(0);
  });
});

describe("parseVersion", () => {
  it("rejects a leading v and other near-misses", () => {
    expect(parseVersion("v1.0.0")).toBeNull();
    expect(parseVersion("1.0")).toBeNull();
    expect(parseVersion("1.0.0")).not.toBeNull();
  });
});

describe("nextVersionCode", () => {
  it("increments only the target environment", () => {
    expect(nextVersionCode({ dev: 3, staging: 7, prod: 1 }, "staging")).toEqual({
      dev: 3,
      staging: 8,
      prod: 1,
    });
  });

  it("fills in missing environments rather than producing NaN", () => {
    // A version-code.json written before an environment existed used to yield
    // `undefined + 1`.
    expect(nextVersionCode({ prod: 4 }, "dev")).toEqual({
      dev: 2,
      staging: 1,
      prod: 4,
    });
  });

  it("starts from 1 when there is no file yet", () => {
    expect(nextVersionCode(null, "prod")).toEqual({
      dev: 1,
      staging: 1,
      prod: 2,
    });
  });
});

describe("versionEnv", () => {
  it("emits the variables Trapeze and Vite both read", () => {
    expect(versionEnv("1.2.3", 45)).toEqual({
      VITE_APP_VERSION: "1.2.3",
      VERSION_CODE: "45",
      BUILD_NUMBER: "45",
    });
  });
});
