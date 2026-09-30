import { compareVersions } from "@capuchoo/core";
import { describe, expect, it } from "vite-plus/test";
import type { AppArtefacts } from "../services/wire.js";
import {
  describeTakenVersion,
  describeVersionRequestProblem,
  nextPrerelease,
  nextPublishedCode,
  publishedBundleVersions,
  resolveReleaseVersion,
} from "./release-version.js";

const ARTEFACTS: AppArtefacts = {
  bundles: [
    { id: "b1", version_name: "0.1.10", platform: "android", flavour: "prod", created_at: "" },
    { id: "b2", version_name: "0.1.11-dev.1", platform: "android", flavour: "dev", created_at: "" },
    { id: "b3", version_name: "0.1.11-dev.3", platform: "android", flavour: "dev", created_at: "" },
    { id: "b4", version_name: "0.1.11-dev.9", platform: "ios", flavour: "dev", created_at: "" },
  ],
  native_builds: [
    {
      id: "n1",
      version_name: "0.1.10",
      version_code: 12,
      platform: "android",
      flavour: "dev",
      created_at: "",
    },
    {
      id: "n2",
      version_name: "0.1.10",
      version_code: 40,
      platform: "android",
      flavour: "prod",
      created_at: "",
    },
  ],
};

const android = publishedBundleVersions(ARTEFACTS, "android");

describe("nextPrerelease", () => {
  it("numbers after the highest prerelease of the next patch", () => {
    expect(nextPrerelease("0.1.10", "dev", android)).toBe("0.1.11-dev.4");
    expect(nextPrerelease("0.1.10", "staging", android)).toBe("0.1.11-staging.1");
    expect(nextPrerelease("0.1.11", "dev", android)).toBe("0.1.12-dev.1");
  });

  it("sorts above what devices run and below the release it precedes", () => {
    const next = nextPrerelease("0.1.10", "dev", android);
    expect(compareVersions(next, "0.1.10")).toBeGreaterThan(0);
    expect(compareVersions(next, "0.1.11-dev.3")).toBeGreaterThan(0);
    expect(compareVersions(next, "0.1.11")).toBeLessThan(0);
  });
});

describe("resolveReleaseVersion", () => {
  const base = { current: "0.1.10", published: android };

  it("keeps package.json without a request, and on prod under auto", () => {
    expect(resolveReleaseVersion({ ...base, request: undefined, environment: "dev" })).toEqual({
      version: "0.1.10",
      origin: null,
    });
    expect(resolveReleaseVersion({ ...base, request: "auto", environment: "prod" }).version).toBe(
      "0.1.10",
    );
  });

  it("bumps semantically, and gives dev a prerelease under auto", () => {
    expect(resolveReleaseVersion({ ...base, request: "minor", environment: "dev" }).version).toBe(
      "0.2.0",
    );
    expect(resolveReleaseVersion({ ...base, request: "auto", environment: "dev" })).toEqual({
      version: "0.1.11-dev.4",
      origin: "next dev build after 0.1.10",
    });
  });
});

describe("exact versions", () => {
  it("publishes a tag's version as given", () => {
    expect(
      resolveReleaseVersion({
        current: "0.1.10",
        published: [],
        request: "v1.2.0",
        environment: "prod",
      }),
    ).toEqual({ version: "1.2.0", origin: "given" });
  });

  it("accepts keywords and versions, and names anything else", () => {
    expect(describeVersionRequestProblem("auto")).toBeNull();
    expect(describeVersionRequestProblem("v1.2.3-rc.1")).toBeNull();
    expect(describeVersionRequestProblem("latest")).toContain('"latest" is none of them');
  });
});

describe("nextPublishedCode", () => {
  it("follows the highest build of the same flavour and platform", () => {
    expect(nextPublishedCode(ARTEFACTS, "android", "dev")).toBe(13);
    expect(nextPublishedCode(ARTEFACTS, "android", "prod")).toBe(41);
    expect(nextPublishedCode(ARTEFACTS, "android", "staging")).toBe(1);
    expect(nextPublishedCode(null, "android", "dev")).toBe(1);
  });
});

describe("describeTakenVersion", () => {
  const input = { kind: "ota" as const, platform: "android" as const, artefacts: ARTEFACTS };

  it("refuses an OTA version the server holds, before anything is built", () => {
    expect(describeTakenVersion({ ...input, version: "0.1.10", environment: "prod" })).toBe(
      "Version 0.1.10 is already published for android. Raise the version in package.json, or pass -v patch.",
    );
    expect(
      describeTakenVersion({ ...input, version: "0.1.11-dev.3", environment: "dev" }),
    ).toContain("-v auto");
  });

  it("allows a free version, another platform's, and native builds", () => {
    expect(describeTakenVersion({ ...input, version: "0.1.12", environment: "prod" })).toBeNull();
    expect(
      describeTakenVersion({ ...input, version: "0.1.11-dev.9", environment: "dev" }),
    ).toBeNull();
    expect(
      describeTakenVersion({ ...input, kind: "native", version: "0.1.10", environment: "prod" }),
    ).toBeNull();
  });
});
