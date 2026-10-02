import { describe, expect, it } from "vite-plus/test";
import { actionLabel, versionLabel } from "./event-labels";

describe("actionLabel", () => {
  it("names the plugin's and the native updater's actions", () => {
    expect(actionLabel("set")).toBe("Bundle applied");
    expect(actionLabel("get")).toBe("Checked for an update");
    expect(actionLabel("download_40")).toBe("Downloading 40%");
  });

  it("humanises an action it does not know rather than hiding it", () => {
    expect(actionLabel("checksum_fail")).toBe("Checksum fail");
    expect(actionLabel("  ")).toBe("Unnamed event");
  });
});

describe("versionLabel", () => {
  const none = { version_from: null, version_to: null, version_code_to: null };

  it("shows a move between versions with the target code", () => {
    expect(versionLabel({ version_from: "1.0.0", version_to: "1.1.0", version_code_to: 11 })).toBe(
      "1.0.0 → 1.1.0 (11)",
    );
  });

  it("shows one version when only one is known or both match", () => {
    expect(versionLabel({ ...none, version_from: "1.0.0" })).toBe("1.0.0");
    expect(versionLabel({ ...none, version_to: "1.1.0" })).toBe("1.1.0");
    expect(versionLabel({ ...none, version_from: "1.1.0", version_to: "1.1.0" })).toBe("1.1.0");
    expect(versionLabel(none)).toBeNull();
  });
});
