import { describe, expect, it } from "vite-plus/test";
import { describeTrapezeRun } from "./native-config.js";

/**
 * Trapeze succeeds when it does nothing. A config whose shape it does not
 * recognise produces a warning, "No changes to apply", and exit code 0 - and the
 * deploy printed "Trapeze applied the flavour configuration" over the top of it.
 *
 * That cost a real cycle: the manifest permission an in-app APK install needs
 * was never added, the step said it had been, and the failure only surfaced on a
 * device as an installer that did nothing.
 */
describe("describeTrapezeRun", () => {
  it("reports a real run as applied", () => {
    const out = "run android manifest 1 modifications\nupdated AndroidManifest.xml";

    expect(describeTrapezeRun({ stdout: out, stderr: "" })).toEqual({ applied: true });
  });

  it("catches a config shape Trapeze does not recognise", () => {
    const out =
      "[warn] Unsupported configuration option android.0. Skipping\n[info] No changes to apply";
    const result = describeTrapezeRun({ stdout: out, stderr: "" });

    expect(result.applied).toBe(false);
    expect(result.warning).toContain("android.0");
    expect(result.warning).toContain("not applied");
  });

  it("catches a run that simply changed nothing", () => {
    const result = describeTrapezeRun({ stdout: "[info] No changes to apply", stderr: "" });

    expect(result.applied).toBe(false);
    expect(result.warning).toContain("nothing to change");
  });

  it("reads stderr as well as stdout", () => {
    const result = describeTrapezeRun({ stdout: "", stderr: "[info] No changes to apply" });

    expect(result.applied).toBe(false);
  });

  it("names the option, so the fix is findable", () => {
    const result = describeTrapezeRun({
      stdout: "[warn] Unsupported configuration option ios.plist.0. Skipping",
      stderr: "",
    });

    expect(result.warning).toContain("ios.plist.0");
  });
});
