import { describe, expect, it } from "vite-plus/test";
import type { GradleAndroidProject } from "../pipeline/gradle-project.js";
import {
  ANDROID_LIBRARY,
  describeAndroidWiring,
  environmentFlavors,
  planAndroidIdentifiers,
} from "./android-steps.js";

function project(flavors: GradleAndroidProject["flavors"] = []): GradleAndroidProject {
  return {
    module: "app",
    buildFile: "app/build.gradle.kts",
    applicationId: "com.example.field",
    flavors,
    appName: "Field",
  };
}

describe("planAndroidIdentifiers", () => {
  it("shares the default id when no flavour changes it", () => {
    expect(planAndroidIdentifiers(project())).toEqual([
      { bundleId: "com.example.field", flavour: null },
    ]);
    expect(
      planAndroidIdentifiers(
        project([
          { name: "dev", applicationId: null, applicationIdSuffix: null },
          { name: "prod", applicationId: null, applicationIdSuffix: null },
        ]),
      ),
    ).toEqual([{ bundleId: "com.example.field", flavour: null }]);
  });

  it("claims an environment for each flavour that installs under its own id", () => {
    expect(
      planAndroidIdentifiers(
        project([
          { name: "dev", applicationId: null, applicationIdSuffix: ".dev" },
          { name: "prod", applicationId: null, applicationIdSuffix: null },
          { name: "demo", applicationId: null, applicationIdSuffix: ".demo" },
        ]),
      ),
    ).toEqual([
      { bundleId: "com.example.field.dev", flavour: "dev" },
      { bundleId: "com.example.field", flavour: "prod" },
    ]);
  });
});

describe("environmentFlavors", () => {
  it("maps only flavours named after an environment", () => {
    expect(
      environmentFlavors(
        project([
          { name: "staging", applicationId: null, applicationIdSuffix: null },
          { name: "acme", applicationId: null, applicationIdSuffix: null },
        ]),
      ),
    ).toEqual({ staging: { gradleFlavor: "staging" } });
  });
});

describe("describeAndroidWiring", () => {
  it("fills in this server and key, and omits what is already done", () => {
    const text = describeAndroidWiring({
      endpoint: "https://updates.example.com",
      publicKey: "MFkw",
      project: project(),
      library: { id: "packages", state: "skipped", detail: "" },
      code: { id: "code", state: "skipped", detail: "" },
    });
    expect(text).toContain('maven("https://jitpack.io")');
    expect(text).toContain(ANDROID_LIBRARY);
    expect(text).toContain('\\"https://updates.example.com\\"');
    expect(text).toContain('\\"MFkw\\"');
    expect(text).toContain("Capuchoo.init(this, CapuchooConfig(");

    const done = describeAndroidWiring({
      endpoint: "https://updates.example.com",
      publicKey: null,
      project: project(),
      library: { id: "packages", state: "satisfied", detail: "" },
      code: { id: "code", state: "skipped", detail: "" },
    });
    expect(done).not.toContain("jitpack.io");
    expect(done).toContain("capuchoo keys init");
  });
});
