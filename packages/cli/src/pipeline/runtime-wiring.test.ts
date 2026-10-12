import { describe, expect, it } from "vite-plus/test";
import { appliesUpdates, assessNativeInstall, NATIVE_INSTALL_PACKAGES } from "./runtime-wiring.js";
import { INSTALL_PERMISSION } from "./wiring.js";

const PERMITTED = `<manifest><uses-permission android:name="${INSTALL_PERMISSION}" /></manifest>`;
const BARE = "<manifest></manifest>";
const allNative = Object.fromEntries(NATIVE_INSTALL_PACKAGES.map((name) => [name, "^8"]));

describe("appliesUpdates", () => {
  it("is false when the app only confirms the running bundle", () => {
    expect(appliesUpdates('import { notifyAppReady } from "@capuchoo/updater";')).toBe(false);
  });

  it("is true for the prompt or the low-level updater", () => {
    expect(appliesUpdates("const update = useUpdatePrompt();")).toBe(true);
    expect(appliesUpdates("await useUpdater().init();")).toBe(true);
  });
});

describe("assessNativeInstall", () => {
  it("does not read the file opener alone as an intent to install APKs", () => {
    const state = assessNativeInstall({
      dependencies: { "@capawesome-team/capacitor-file-opener": "^8" },
      manifest: BARE,
      nativeChannels: [],
    });
    expect(state).toEqual({ intended: false, missingPackages: [], missingPermission: false });
  });

  it("treats a channel serving an APK as intent, and names what is missing", () => {
    const state = assessNativeInstall({
      dependencies: { "@capawesome-team/capacitor-file-opener": "^8" },
      manifest: PERMITTED,
      nativeChannels: ["dev"],
    });
    expect(state.intended).toBe(true);
    expect(state.missingPackages).toContain("@capacitor/file-transfer");
    expect(state.missingPackages).not.toContain("@capawesome-team/capacitor-file-opener");
    expect(state.missingPermission).toBe(false);
  });

  it("flags the permission once the downloader is installed", () => {
    const state = assessNativeInstall({
      dependencies: allNative,
      manifest: BARE,
      nativeChannels: [],
    });
    expect(state).toEqual({ intended: true, missingPackages: [], missingPermission: true });
  });

  it("says nothing about a manifest that has not been generated", () => {
    expect(
      assessNativeInstall({ dependencies: allNative, manifest: null, nativeChannels: [] })
        .missingPermission,
    ).toBe(false);
  });
});
