import { describe, expect, it } from "vite-plus/test";
import { conflictingIds, detectIdentity } from "./app-identity.js";

/** efficy: a plain literal config. */
const EFFICY_CONFIG = `
import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.efficy.app",
  appName: "Efficy",
  webDir: "dist",
};
export default config;
`;

/** Lowmaro: the value comes from the environment with a literal fallback. */
const LOWMARO_CONFIG = `
const config: CapacitorConfig = {
  appId: process.env.VITE_APP_ID ?? "com.ayb.lowmaro",
  appName: process.env.VITE_APP_NAME ?? "Lowmaro",
  webDir: "dist",
};
`;

const GRADLE = `
android {
    namespace "com.efficy.app"
    defaultConfig {
        applicationId "com.efficy.app"
        versionCode 52
    }
    productFlavors {
        dev { applicationIdSuffix ".dev" }
    }
}
`;

describe("detectIdentity", () => {
  it("reads a literal capacitor config", () => {
    expect(detectIdentity({ capacitorConfig: EFFICY_CONFIG })).toEqual({
      appId: { value: "com.efficy.app", source: "capacitor.config" },
      appName: { value: "Efficy", source: "capacitor.config" },
    });
  });

  /**
   * Both real apps write `process.env.X ?? "literal"`. Taking the first quoted
   * string would return the env var name; the fallback is the actual value.
   */
  it("reads the fallback out of an env-driven config", () => {
    expect(detectIdentity({ capacitorConfig: LOWMARO_CONFIG })).toMatchObject({
      appId: { value: "com.ayb.lowmaro" },
      appName: { value: "Lowmaro" },
    });
  });

  // Gradle's applicationId is what ships in the APK and what a device reports.
  it("prefers Gradle over the capacitor config", () => {
    const identity = detectIdentity({
      capacitorConfig: LOWMARO_CONFIG,
      buildGradle: GRADLE,
    });

    expect(identity.appId).toEqual({
      value: "com.efficy.app",
      source: "android/app/build.gradle",
    });
  });

  // `applicationIdSuffix` belongs to a flavour and is not the base identifier.
  it("does not mistake a flavour suffix for the application id", () => {
    expect(detectIdentity({ buildGradle: GRADLE }).appId?.value).toBe("com.efficy.app");
  });

  it("falls back to the env file", () => {
    expect(detectIdentity({ envFile: "VITE_APP_ID=com.acme.app\nVITE_APP_NAME=Acme\n" })).toEqual({
      appId: { value: "com.acme.app", source: "the production env file" },
      appName: { value: "Acme", source: "the production env file" },
    });
  });

  it("ignores a commented-out env value", () => {
    expect(detectIdentity({ envFile: "#VITE_APP_ID=com.acme.app\n" }).appId).toBeUndefined();
  });

  it("ignores an empty env value", () => {
    expect(detectIdentity({ envFile: "VITE_APP_ID=\n" }).appId).toBeUndefined();
  });

  it("takes a name from package.json when nothing better exists", () => {
    expect(detectIdentity({ packageJson: '{"name":"lowmaro","version":"1.0.0"}' }).appName).toEqual(
      { value: "lowmaro", source: "package.json" },
    );
  });

  // A name is not a bundle id; suggesting one would fail server-side validation.
  it("refuses a candidate that is not a bundle identifier", () => {
    expect(detectIdentity({ envFile: "VITE_APP_ID=not a bundle id\n" }).appId).toBeUndefined();
  });

  it("survives a malformed package.json", () => {
    expect(detectIdentity({ packageJson: "{ not json" })).toEqual({});
  });

  it("detects nothing from nothing", () => {
    expect(detectIdentity({})).toEqual({});
  });
});

describe("conflictingIds", () => {
  /**
   * The failure this exists to surface: the device reports the id compiled into
   * the binary, so a Gradle applicationId that disagrees with the linked app
   * produces "App not found" - and only on a device.
   */
  it("reports every place that disagrees with the chosen id", () => {
    const conflicts = conflictingIds(
      { buildGradle: GRADLE, capacitorConfig: LOWMARO_CONFIG },
      "com.efficy.app",
    );

    expect(conflicts).toEqual([{ value: "com.ayb.lowmaro", source: "capacitor.config" }]);
  });

  it("is quiet when everything agrees", () => {
    expect(
      conflictingIds({ buildGradle: GRADLE, capacitorConfig: EFFICY_CONFIG }, "com.efficy.app"),
    ).toEqual([]);
  });
});
