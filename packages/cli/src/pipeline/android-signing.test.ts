import { describe, expect, it } from "vite-plus/test";
import { describeSigning, inspectReleaseSigning } from "./android-signing.js";

/**
 * Taken from efficy, the project where this failed. The signing config reads
 * four properties out of local.properties and the release build type uses it.
 */
const REAL_GRADLE = `
android {
    namespace "com.efficy.app"
    defaultConfig {
        applicationId "com.efficy.app"
        versionCode 61
    }

     signingConfigs {
        release {
               def storeFilePath = properties.getProperty("RELEASE_STORE_FILE")
               if (storeFilePath) {
                   storeFile file(storeFilePath)
                }
                storePassword properties.getProperty("RELEASE_STORE_PASSWORD")
                keyAlias properties.getProperty("RELEASE_KEY_ALIAS")
                keyPassword properties.getProperty("RELEASE_KEY_PASSWORD")

            v1SigningEnabled true
            v2SigningEnabled true
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
    flavorDimensions "client"
    productFlavors {
        dev { applicationIdSuffix ".dev" }
        prod { versionNameSuffix "" }
    }
}
`;

const ALL_SET = `
sdk.dir=C:/Users/x/AppData/Local/Android/Sdk
RELEASE_STORE_FILE=../keystore.jks
RELEASE_STORE_PASSWORD=hunter2
RELEASE_KEY_ALIAS=upload
RELEASE_KEY_PASSWORD=hunter2
`;

describe("inspectReleaseSigning", () => {
  /**
   * The exact situation on the machine where the deploy failed: local.properties
   * has the SDK path and nothing else.
   */
  it("names every property the build file reads but the machine has not set", () => {
    const status = inspectReleaseSigning({
      buildGradle: REAL_GRADLE,
      localProperties: "sdk.dir=C:/Users/x/AppData/Local/Android/Sdk\n",
    });

    expect(status).toEqual({
      kind: "unconfigured",
      configName: "release",
      missing: [
        "RELEASE_STORE_FILE",
        "RELEASE_STORE_PASSWORD",
        "RELEASE_KEY_ALIAS",
        "RELEASE_KEY_PASSWORD",
      ],
    });
  });

  it("is ready when they are all there, and reports the keystore path", () => {
    expect(inspectReleaseSigning({ buildGradle: REAL_GRADLE, localProperties: ALL_SET })).toEqual({
      kind: "ready",
      configName: "release",
      storeFile: "../keystore.jks",
    });
  });

  it("reports a partially filled file as unconfigured", () => {
    const status = inspectReleaseSigning({
      buildGradle: REAL_GRADLE,
      localProperties: "RELEASE_STORE_FILE=../keystore.jks\nRELEASE_KEY_ALIAS=upload\n",
    });

    expect(status).toMatchObject({
      kind: "unconfigured",
      missing: ["RELEASE_STORE_PASSWORD", "RELEASE_KEY_PASSWORD"],
    });
  });

  // A key present but empty is not set. This is what a half-edited file looks
  // like, and Gradle treats it the same as absent.
  it("treats a blank value as unset", () => {
    expect(
      inspectReleaseSigning({
        buildGradle: REAL_GRADLE,
        localProperties: ALL_SET.replace("RELEASE_KEY_PASSWORD=hunter2", "RELEASE_KEY_PASSWORD="),
      }),
    ).toMatchObject({ kind: "unconfigured", missing: ["RELEASE_KEY_PASSWORD"] });
  });

  it("ignores a commented-out property", () => {
    expect(
      inspectReleaseSigning({
        buildGradle: REAL_GRADLE,
        localProperties: ALL_SET.replace("RELEASE_KEY_ALIAS=upload", "#RELEASE_KEY_ALIAS=upload"),
      }),
    ).toMatchObject({ kind: "unconfigured", missing: ["RELEASE_KEY_ALIAS"] });
  });

  /**
   * No signingConfig at all. Gradle produces an unsigned APK quite happily and
   * Android refuses to install it, so this is worth saying even though the
   * packaging task succeeds.
   */
  it("reports a release build type that signs with nothing", () => {
    expect(
      inspectReleaseSigning({
        buildGradle:
          "android {\n  buildTypes {\n    release {\n      minifyEnabled false\n    }\n  }\n}",
        localProperties: "",
      }),
    ).toEqual({ kind: "unsigned" });
  });

  // `buildTypes` also contains a `debug` block, and `productFlavors` contains
  // identifier blocks of its own - a parser that grabbed the first `release {`
  // anywhere would read the signingConfigs entry instead of the build type.
  it("does not confuse the signing config with the build type of the same name", () => {
    const status = inspectReleaseSigning({ buildGradle: REAL_GRADLE, localProperties: ALL_SET });
    expect(status.kind).toBe("ready");
  });

  it("reads whatever property names the project chose", () => {
    const custom = `
      android {
        signingConfigs { upload { storePassword properties.getProperty("MY_OWN_SECRET") } }
        buildTypes { release { signingConfig signingConfigs.upload } }
      }
    `;

    expect(inspectReleaseSigning({ buildGradle: custom, localProperties: "" })).toEqual({
      kind: "unconfigured",
      configName: "upload",
      missing: ["MY_OWN_SECRET"],
    });
  });

  it("survives a build file with no android block", () => {
    expect(inspectReleaseSigning({ buildGradle: "", localProperties: "" })).toEqual({
      kind: "unsigned",
    });
  });
});

describe("describeSigning", () => {
  it("says where the values go and what happens without them", () => {
    const message = describeSigning({
      kind: "unconfigured",
      configName: "release",
      missing: ["RELEASE_STORE_FILE"],
    });

    expect(message).toContain("android/local.properties");
    expect(message).toContain("after compiling everything");
  });

  it("says why an unsigned APK is a problem at all", () => {
    expect(describeSigning({ kind: "unsigned" })).toContain("refuse to install");
  });
});
