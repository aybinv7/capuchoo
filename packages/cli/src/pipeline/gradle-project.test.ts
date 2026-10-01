import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  detectGradleAndroidProject,
  flavorApplicationId,
  includedModules,
} from "./gradle-project.js";

let root: string;

function write(relative: string, contents: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

const KOTLIN_APP = `
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.example.field"
    defaultConfig {
        applicationId = "com.example.field"
        versionCode = 12
    }
    flavorDimensions += "environment"
    productFlavors {
        create("dev") {
            dimension = "environment"
            applicationIdSuffix = ".dev"
            buildConfigField("String", "CAPUCHOO_CHANNEL", "\\"dev\\"")
        }
        create("prod") {
            dimension = "environment"
        }
    }
}
`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-gradle-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("detectGradleAndroidProject", () => {
  it("reads a Kotlin DSL app with flavours and an app name", () => {
    write("settings.gradle.kts", 'rootProject.name = "field"\ninclude(":app")\n');
    write("app/build.gradle.kts", KOTLIN_APP);
    write(
      "app/src/main/res/values/strings.xml",
      '<resources><string name="app_name">Field</string></resources>',
    );

    expect(detectGradleAndroidProject(root)).toEqual({
      module: "app",
      buildFile: "app/build.gradle.kts",
      applicationId: "com.example.field",
      flavors: [
        { name: "dev", applicationId: null, applicationIdSuffix: ".dev" },
        { name: "prod", applicationId: null, applicationIdSuffix: null },
      ],
      appName: "Field",
    });
  });

  it("finds the application module of a Kotlin Multiplatform project", () => {
    write("settings.gradle.kts", 'include(":shared")\ninclude(":composeApp")\n');
    write("shared/build.gradle.kts", "plugins { alias(libs.plugins.android.library) }");
    write(
      "composeApp/build.gradle.kts",
      'plugins { alias(libs.plugins.androidApplication) }\nandroid { defaultConfig { applicationId = "com.example.kmp" } }',
    );
    const project = detectGradleAndroidProject(root);
    expect(project?.module).toBe("composeApp");
    expect(project?.applicationId).toBe("com.example.kmp");
  });

  it("reads a Groovy app", () => {
    write("settings.gradle", "include ':app'");
    write(
      "app/build.gradle",
      "apply plugin: 'com.android.application'\nandroid {\n  defaultConfig {\n    applicationId \"com.example.groovy\"\n  }\n}\n",
    );
    expect(detectGradleAndroidProject(root)?.applicationId).toBe("com.example.groovy");
  });

  it("leaves Capacitor projects and plain libraries alone", () => {
    write("settings.gradle.kts", 'include(":lib")');
    write("lib/build.gradle.kts", 'plugins { id("com.android.library") }');
    expect(detectGradleAndroidProject(root)).toBeNull();
    write("app/build.gradle.kts", KOTLIN_APP);
    write("capacitor.config.ts", "export default {}");
    expect(detectGradleAndroidProject(root)).toBeNull();
  });
});

describe("helpers", () => {
  it("lists included modules in either DSL", () => {
    expect(includedModules('include(":app", ":feature:login")\ninclude \':core\'')).toEqual([
      "app",
      "feature/login",
      "core",
    ]);
  });

  it("builds a flavour's id from the default and its suffix", () => {
    const flavor = { name: "dev", applicationId: null, applicationIdSuffix: ".dev" };
    expect(flavorApplicationId("com.example.field", flavor)).toBe("com.example.field.dev");
    expect(
      flavorApplicationId("com.example.field", { ...flavor, applicationId: "com.other" }),
    ).toBe("com.other");
  });
});
