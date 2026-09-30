import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { applyNativeConfig } from "./native-config.js";
import type { ResolvedFlavour } from "./flavour.js";

const GRADLE = `android {
    namespace = "com.presalio.retail.app"
    defaultConfig {
        applicationId "com.presalio.retail.app"
        versionCode 3
        versionName "0.1.7"
    }
}
`;

let root: string;
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("the built-in Android patcher", () => {
  it("changes the applicationId per flavour and never the namespace", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "capuchoo-namespace-"));
    const gradle = path.join(root, "android", "app", "build.gradle");
    fs.mkdirSync(path.dirname(gradle), { recursive: true });
    fs.writeFileSync(gradle, GRADLE);

    const flavour = {
      environment: "dev",
      config: {},
      envFile: null,
      trapezeConfig: null,
      assetPath: null,
      fileEnv: {},
      mode: "dev",
    } as unknown as ResolvedFlavour;

    await applyNativeConfig({
      appDir: root,
      androidDir: "android",
      iosDir: "ios",
      flavour,
      env: {
        VITE_APP_ID: "com.presalio.retail.app.dev",
        VITE_APP_VERSION: "0.1.8",
        VERSION_CODE: "4",
      },
      platform: "android",
      runOptions: {} as never,
    });

    const patched = fs.readFileSync(gradle, "utf8");
    expect(patched).toContain('namespace = "com.presalio.retail.app"');
    expect(patched).toContain('applicationId "com.presalio.retail.app.dev"');
    expect(patched).toContain("versionCode 4");
    expect(patched).toContain('versionName "0.1.8"');
  });
});
