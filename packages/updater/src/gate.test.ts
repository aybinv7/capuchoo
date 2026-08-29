import { describe, expect, it } from "vite-plus/test";
import { isDismissible, updateGate, type GateFacts } from "./gate.js";

const idle: GateFacts = {
  available: true,
  required: false,
  kind: "native",
  downloading: false,
  installing: false,
  downloaded: false,
  handedToInstaller: false,
};

const required = { ...idle, required: true };

describe("updateGate", () => {
  it("stays open when nothing is on offer", () => {
    expect(updateGate({ ...idle, available: false }).blocked).toBe(false);
  });

  it("stays open for an optional update, at every stage", () => {
    // An optional update that blocks anything is just a required one with worse
    // manners.
    for (const stage of [
      idle,
      { ...idle, downloading: true },
      { ...idle, downloaded: true },
      { ...idle, handedToInstaller: true },
    ]) {
      expect(updateGate(stage).blocked, JSON.stringify(stage)).toBe(false);
    }
  });

  it("blocks a required update that has not started", () => {
    expect(updateGate(required)).toMatchObject({ state: "must-start", blocked: true });
    expect(updateGate(required).reason).toContain("required");
  });

  /**
   * The concession that makes "required" survivable. Holding someone for the
   * whole of an 8 MB download teaches them to force-quit, and a force-quit
   * mid-download is how an update never lands at all.
   */
  it("opens again while the download runs, even when required", () => {
    expect(updateGate({ ...required, downloading: true })).toEqual({
      state: "open",
      blocked: false,
      reason: "",
    });
  });

  it("closes again once a required native update is downloaded", () => {
    expect(updateGate({ ...required, downloaded: true })).toMatchObject({
      state: "must-install",
      blocked: true,
    });
  });

  /**
   * An OTA bundle applies itself, so it never rests at "downloaded" waiting for
   * a tap - it would be blocked at must-start and then simply gone.
   */
  it("never asks to install an OTA bundle", () => {
    expect(updateGate({ ...required, kind: "ota", downloaded: true }).state).toBe("must-start");
  });

  it("waits on Android once the APK is handed over", () => {
    expect(updateGate({ ...required, downloaded: true, handedToInstaller: true })).toMatchObject({
      state: "awaiting-install",
      blocked: true,
    });
  });

  /**
   * Order matters here: the handoff happens after a download, and an app that
   * also kicked off a background check would otherwise read as busy and open the
   * gate while Android's dialog was up.
   */
  it("prefers awaiting-install over a concurrent download", () => {
    expect(updateGate({ ...required, downloading: true, handedToInstaller: true }).state).toBe(
      "awaiting-install",
    );
  });

  it("always explains itself when it blocks", () => {
    for (const facts of [
      required,
      { ...required, downloaded: true },
      { ...required, handedToInstaller: true },
    ]) {
      const gate = updateGate(facts);
      expect(gate.blocked).toBe(true);
      expect(gate.reason.length).toBeGreaterThan(10);
    }
  });
});

describe("isDismissible", () => {
  it("lets an idle optional update be dismissed", () => {
    expect(isDismissible(idle)).toBe(true);
  });

  it("never lets a required update be dismissed", () => {
    expect(isDismissible(required)).toBe(false);
    expect(isDismissible({ ...required, downloading: true })).toBe(false);
  });

  /**
   * The case the two functions disagree on, deliberately: a required update
   * mid-download leaves the app usable and the prompt on screen. It is not
   * blocking, and it is not going away.
   */
  it("keeps a downloading required update on screen while the app stays usable", () => {
    const facts = { ...required, downloading: true };

    expect(updateGate(facts).blocked).toBe(false);
    expect(isDismissible(facts)).toBe(false);
  });

  it("will not dismiss an optional update mid-flight", () => {
    expect(isDismissible({ ...idle, downloading: true })).toBe(false);
    expect(isDismissible({ ...idle, installing: true })).toBe(false);
    expect(isDismissible({ ...idle, handedToInstaller: true })).toBe(false);
  });

  it("has nothing to dismiss when nothing is offered", () => {
    expect(isDismissible({ ...idle, available: false })).toBe(false);
  });
});
