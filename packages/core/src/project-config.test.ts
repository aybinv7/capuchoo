import { describe, expect, it } from "vite-plus/test";
import {
  describeEnvironmentMismatch,
  environmentFromAppId,
  isEnvironmentAllowed,
  isValidBundleId,
  normaliseProjectConfig,
  validateProjectConfig,
  type ProjectConfig,
} from "./project-config.js";

const v1: ProjectConfig = {
  appId: "com.ayb.lowmaro",
  cloudAppId: "d9c93705-3fd3-4347-85cc-ae1967010993",
  appName: "Lowmaro",
  createdAt: "2026-08-14T23:37:03.738Z",
};

describe("normaliseProjectConfig", () => {
  it("gives a v1 file the conventional layout so it keeps deploying", () => {
    const resolved = normaliseProjectConfig(v1);

    expect(resolved.version).toBe(1);
    expect(resolved.webDir).toBe("dist");
    expect(resolved.versionCodeFile).toBe("version-code.json");
    expect(resolved.flavours.staging).toEqual({
      envFile: "build/staging/.env.staging",
      trapezeConfig: "build/staging/trapeze.staging.yaml",
      assetPath: "build/staging/assets",
      mode: "staging",
    });
  });

  it("keeps declared flavour fields and defaults only the rest", () => {
    const resolved = normaliseProjectConfig({
      ...v1,
      version: 2,
      flavours: { prod: { envFile: "env/production" } },
    });

    expect(resolved.flavours.prod.envFile).toBe("env/production");
    expect(resolved.flavours.prod.trapezeConfig).toBe("build/prod/trapeze.prod.yaml");
    expect(resolved.flavours.dev.envFile).toBe("build/dev/.env.dev");
  });

  it("carries the deprecated monorepo fields into an explicit build command", () => {
    const resolved = normaliseProjectConfig({
      ...v1,
      monorepoRoot: "../..",
      packageName: "presalio",
    });

    expect(resolved.build.cwd).toBe("../..");
    expect(resolved.build.command).toBe("vp run presalio#build");
  });

  it("lets an explicit build block win over the deprecated fields", () => {
    const resolved = normaliseProjectConfig({
      ...v1,
      monorepoRoot: "../..",
      packageName: "presalio",
      build: { command: "make web", cwd: "." },
    });

    expect(resolved.build).toEqual({ command: "make web", cwd: "." });
  });
});

describe("validateProjectConfig", () => {
  it("accepts a complete config", () => {
    expect(validateProjectConfig(v1)).toEqual([]);
  });

  it("reports every missing field at once", () => {
    expect(validateProjectConfig({})).toHaveLength(3);
  });

  it("rejects a bundle id that is not one", () => {
    expect(validateProjectConfig({ ...v1, appId: "Lowmaro" })).toEqual([
      'appId "Lowmaro" is not a valid bundle identifier',
    ]);
  });

  it("treats a missing file as a problem, not a crash", () => {
    expect(validateProjectConfig(null)).toEqual(["project.json is missing or empty"]);
  });
});

describe("isValidBundleId", () => {
  it("requires at least two lower-case segments", () => {
    expect(isValidBundleId("com.ayb.lowmaro")).toBe(true);
    expect(isValidBundleId("io.capucho.inv.staging")).toBe(true);
    expect(isValidBundleId("lowmaro")).toBe(false);
    expect(isValidBundleId("Com.Ayb.Lowmaro")).toBe(false);
    expect(isValidBundleId("com..lowmaro")).toBe(false);
    expect(isValidBundleId("1com.lowmaro")).toBe(false);
  });
});

describe("isEnvironmentAllowed", () => {
  it("allows a build on a channel of its own environment", () => {
    expect(isEnvironmentAllowed("io.capucho.inv", "prod")).toBe(true);
    expect(isEnvironmentAllowed("io.capucho.inv.staging", "staging")).toBe(true);
    expect(isEnvironmentAllowed("io.capucho.inv.dev", "dev")).toBe(true);
  });

  it("allows a production build on a staging channel", () => {
    // The server permits this on purpose, so a release candidate can be
    // beta-tested by real installs. Lowmaro relies on it: its app id carries no
    // suffix and all three of its channels are bound to staging.
    expect(isEnvironmentAllowed("com.ayb.lowmaro", "staging")).toBe(true);
  });

  it("refuses everything else", () => {
    expect(isEnvironmentAllowed("io.capucho.inv", "dev")).toBe(false);
    expect(isEnvironmentAllowed("io.capucho.inv.staging", "prod")).toBe(false);
    expect(isEnvironmentAllowed("io.capucho.inv.dev", "prod")).toBe(false);
    expect(isEnvironmentAllowed("io.capucho.inv.dev", "staging")).toBe(false);
  });
});

describe("describeEnvironmentMismatch", () => {
  it("says nothing when the pairing is allowed", () => {
    expect(describeEnvironmentMismatch("com.ayb.lowmaro", "staging", "prod")).toBeNull();
  });

  it("names the channel, the environment and the bundle id", () => {
    const message = describeEnvironmentMismatch("io.capucho.inv.staging", "prod", "production");
    expect(message).toContain("production");
    expect(message).toContain("io.capucho.inv.staging");
  });
});

describe("environmentFromAppId", () => {
  it("mirrors the isolation rule the backend enforces", () => {
    expect(environmentFromAppId("io.capucho.inv")).toBe("prod");
    expect(environmentFromAppId("io.capucho.inv.staging")).toBe("staging");
    expect(environmentFromAppId("io.capucho.inv.dev")).toBe("dev");
    expect(environmentFromAppId("io.capucho.inv.debug")).toBe("dev");
    expect(environmentFromAppId("IO.Capucho.Inv.STAGING")).toBe("staging");
  });
});
