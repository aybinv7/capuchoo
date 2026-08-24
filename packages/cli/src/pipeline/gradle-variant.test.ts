import { describe, expect, it } from "vite-plus/test";
import { assembleTask, chooseFlavor, parseProductFlavors } from "./gradle-variant.js";

// Shape taken from a real flavoured app: two flavours, each with nested config,
// inside an `android { }` block that also declares buildTypes.
const REAL = `
android {
    namespace "com.efficy.app"
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
    flavorDimensions "client"
    productFlavors {
        dev {
            versionNameSuffix "-dev"
            applicationIdSuffix ".dev"

            resValue "string", "app_name", "Efficy [Dev]"
        }
        prod {
            versionNameSuffix ""

            resValue "string", "app_name", "Efficy"
        }
    }
}
`;

describe("parseProductFlavors", () => {
  it("reads the flavour names, not their configuration", () => {
    expect(parseProductFlavors(REAL)).toEqual(["dev", "prod"]);
  });

  it("returns none for a project without flavours", () => {
    expect(parseProductFlavors("android {\n  buildTypes {\n    release {}\n  }\n}")).toEqual([]);
  });

  // buildTypes also contains nested identifier blocks, so a parser that only
  // matched `name {` anywhere would report `release` as a flavour.
  it("does not mistake buildTypes entries for flavours", () => {
    expect(parseProductFlavors(REAL)).not.toContain("release");
  });
});

describe("assembleTask", () => {
  it("names the variant when there is a flavour", () => {
    expect(assembleTask("debug", "prod")).toBe("assembleProdDebug");
    expect(assembleTask("release", "dev")).toBe("assembleDevRelease");
  });

  it("falls back to the plain task without one", () => {
    expect(assembleTask("debug")).toBe("assembleDebug");
  });
});

describe("chooseFlavor", () => {
  it("takes --flavor over everything", () => {
    expect(
      chooseFlavor({ flavors: ["dev", "prod"], requested: "dev", environment: "prod" }),
    ).toMatchObject({ kind: "chosen", flavor: "dev" });
  });

  it("reports none when the project has no flavours", () => {
    expect(chooseFlavor({ flavors: [], environment: "prod" })).toEqual({ kind: "none" });
  });

  it("takes the only flavour without asking", () => {
    expect(chooseFlavor({ flavors: ["prod"], environment: "staging" })).toMatchObject({
      kind: "chosen",
      flavor: "prod",
    });
  });

  it("matches a flavour named after the channel's environment", () => {
    expect(chooseFlavor({ flavors: ["dev", "prod"], environment: "dev" })).toMatchObject({
      kind: "chosen",
      flavor: "dev",
    });
  });

  // The case that matters: staging against dev/prod has no right answer, and
  // guessing would ship a different applicationId to real devices.
  it("refuses to guess when nothing matches", () => {
    expect(chooseFlavor({ flavors: ["dev", "prod"], environment: "staging" })).toEqual({
      kind: "ambiguous",
      flavors: ["dev", "prod"],
    });
  });
});
