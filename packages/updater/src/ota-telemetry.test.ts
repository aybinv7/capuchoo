import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Every OTA update ever applied was invisible.
 *
 * `logUpdateEvent` returned early for anything that was not a native update,
 * on the grounds that "OTA events are reported by the plugin itself through its
 * statsUrl". They are not. The plugin reports its own auto-update flow, and
 * this library exists precisely because the app drives updates instead:
 * `autoUpdate` is "onlyDownload", `directUpdate` is false, and the app calls
 * `set()` once the user agrees. None of that path belongs to the plugin, so the
 * plugin has nothing to report.
 *
 * Measured on a real device that had just taken three bundles in an afternoon:
 *
 *   {"delivered":0,"check":31,"lifecycle":8,"total":39}
 *
 * `delivered: 0` beside `check: 31` reads as "everyone is checking and nobody
 * is updating" - the shape of an outage, produced by a system that was working.
 */
const api = fs.readFileSync(path.join(import.meta.dirname, "api.service.ts"), "utf8");
const updater = fs.readFileSync(path.join(import.meta.dirname, "vue/useUpdater.ts"), "utf8");

describe("OTA updates report themselves", () => {
  it("does not skip everything that is not native", () => {
    expect(api).not.toContain('if (update.kind !== "native") return;');
  });

  it("records a delivery when a bundle is applied", () => {
    expect(updater).toContain('await logUpdateEvent("install", update)');
  });

  /**
   * Applying an OTA bundle reloads the WebView, so nothing after that call ever
   * executes. An event logged afterwards is an event never sent - there is no
   * "after" to report from.
   */
  it("records it before applying, because applying ends the JS context", () => {
    const logged = updater.indexOf('await logUpdateEvent("install", update)');
    const applied = updater.indexOf("await applyOtaUpdate(update)");

    expect(logged).toBeGreaterThan(-1);
    expect(applied).toBeGreaterThan(-1);
    expect(logged).toBeLessThan(applied);
  });

  it("still reports a failure, so a claimed delivery that did not land is visible", () => {
    // The trade this makes: the delivery is claimed before the apply succeeds.
    // The pair of events is what keeps it honest.
    expect(updater).toContain(
      'await logUpdateEvent("error", update, { error: state.value.error })',
    );
  });

  /**
   * A web bundle has no build number of its own - the binary underneath is
   * unchanged - so sending the device's own code would claim the update changed
   * it, and the dashboard would show an OTA release as a native one.
   */
  it("sends a version code only for native updates", () => {
    expect(api).toContain(
      '...(update.kind === "native" ? { new_version_code: update.versionCode }',
    );
  });
});
