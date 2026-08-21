import { describe, expect, it } from "vite-plus/test";
import {
  environmentMismatchWarning,
  hasEnvironmentMismatch,
  suggestEnvironment,
} from "./channel-environment.js";

describe("suggestEnvironment", () => {
  it("recognises the conventional names", () => {
    expect(suggestEnvironment("prod")).toBe("prod");
    expect(suggestEnvironment("production")).toBe("prod");
    expect(suggestEnvironment("release")).toBe("prod");
    expect(suggestEnvironment("staging")).toBe("staging");
    expect(suggestEnvironment("beta")).toBe("staging");
    expect(suggestEnvironment("dev")).toBe("dev");
    expect(suggestEnvironment("debug")).toBe("dev");
  });

  it("ignores case and surrounding whitespace", () => {
    expect(suggestEnvironment("  PROD ")).toBe("prod");
  });

  it("says nothing about names it cannot reason about", () => {
    expect(suggestEnvironment("prod-eu")).toBeNull();
    expect(suggestEnvironment("customer-a")).toBeNull();
    expect(suggestEnvironment("")).toBeNull();
    expect(suggestEnvironment("   ")).toBeNull();
  });
});

describe("hasEnvironmentMismatch", () => {
  it("flags the case that shipped staging bundles to prod devices", () => {
    expect(hasEnvironmentMismatch("prod", "staging")).toBe(true);
  });

  it("is quiet when the name and the environment agree", () => {
    expect(hasEnvironmentMismatch("prod", "prod")).toBe(false);
    expect(hasEnvironmentMismatch("staging", "staging")).toBe(false);
  });

  it("is quiet while no environment is chosen yet", () => {
    expect(hasEnvironmentMismatch("prod", "")).toBe(false);
  });

  it("is quiet for a name that implies nothing", () => {
    expect(hasEnvironmentMismatch("customer-a", "staging")).toBe(false);
  });
});

describe("environmentMismatchWarning", () => {
  it("names both sides and the .env file that follows from the choice", () => {
    const warning = environmentMismatchWarning("prod", "staging");

    expect(warning).toContain('"prod"');
    expect(warning).toContain("staging environment");
    expect(warning).toContain(".env.staging");
  });

  it("returns null when there is nothing to warn about", () => {
    expect(environmentMismatchWarning("prod", "prod")).toBeNull();
    expect(environmentMismatchWarning("prod", "")).toBeNull();
  });
});
