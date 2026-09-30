import { describe, expect, it } from "vite-plus/test";
import { canPoint, type PointerArtefact, type PointerChannel } from "./channel-pointer.js";

const channel: PointerChannel = {
  appId: "app-1",
  name: "prod",
  environment: "prod",
  kind: "release",
  currentNativeCode: 10,
  currentBundleGate: null,
  currentVersion: { versionName: "1.4.0" },
};

const bundle: PointerArtefact = {
  appId: "app-1",
  kind: "ota",
  platform: "android",
  flavour: "prod",
  versionName: "1.5.0",
};

const native: PointerArtefact = {
  appId: "app-1",
  kind: "native",
  platform: "android",
  flavour: "prod",
  versionName: "1.5.0",
  versionCode: 11,
};

describe("canPoint", () => {
  it("moves forward", () => {
    expect(canPoint({ channel, artefact: bundle })).toEqual({ ok: true, direction: "forward" });
  });

  it("accepts the same version as a no-op", () => {
    expect(canPoint({ channel, artefact: { ...bundle, versionName: "1.4.0" } })).toEqual({
      ok: true,
      direction: "same",
    });
  });

  it("points an empty channel at anything valid", () => {
    expect(canPoint({ channel: { ...channel, currentVersion: null }, artefact: bundle }).ok).toBe(
      true,
    );
  });

  it.each([
    ["another app", { appId: "app-2" }, "other-app"],
    ["no flavour", { flavour: null }, "unflavoured"],
    ["another flavour", { flavour: "staging" as const }, "flavour-mismatch"],
  ])("refuses %s", (_label, patch, reason) => {
    const verdict = canPoint({ channel, artefact: { ...bundle, ...patch } });
    expect(verdict).toMatchObject({ ok: false, reason });
  });

  it("refuses a platform the channel switched off", () => {
    expect(
      canPoint({ channel: { ...channel, androidEnabled: false }, artefact: bundle }),
    ).toMatchObject({ ok: false, reason: "platform-disabled" });
  });

  describe("client channels", () => {
    const client: PointerChannel = { ...channel, name: "prod-acme", kind: "client" };

    it("refuses what the base never served", () => {
      expect(canPoint({ channel: client, artefact: bundle, servedByBase: false })).toMatchObject({
        ok: false,
        reason: "not-on-base",
      });
    });

    it("accepts what the base served", () => {
      expect(canPoint({ channel: client, artefact: bundle, servedByBase: true }).ok).toBe(true);
    });
  });

  describe("native gates", () => {
    it("refuses a bundle the channel's native cannot run", () => {
      expect(canPoint({ channel, artefact: { ...bundle, minNativeVersion: 12 } })).toMatchObject({
        ok: false,
        reason: "native-gate",
      });
    });

    it("accepts a bundle the channel's native satisfies", () => {
      expect(canPoint({ channel, artefact: { ...bundle, minNativeVersion: "10" } }).ok).toBe(true);
    });

    it("refuses a malformed gate", () => {
      expect(
        canPoint({ channel, artefact: { ...bundle, minNativeVersion: "2.4.0" } }),
      ).toMatchObject({ ok: false, reason: "native-gate" });
    });

    it("refuses a native that would strand the served bundle", () => {
      const gated: PointerChannel = {
        ...channel,
        currentBundleGate: 12,
        currentVersion: { versionName: "1.4.0", versionCode: 10 },
      };
      expect(canPoint({ channel: gated, artefact: native })).toMatchObject({
        ok: false,
        reason: "strands-bundle",
      });
    });
  });

  describe("downgrades", () => {
    const older = { ...bundle, versionName: "1.3.0" };

    it("refuses an older version without a rollback", () => {
      expect(canPoint({ channel, artefact: older })).toMatchObject({
        ok: false,
        reason: "downgrade-needs-rollback",
      });
    });

    it("allows an older version as a rollback", () => {
      expect(canPoint({ channel, artefact: older, rollback: true })).toEqual({
        ok: true,
        direction: "downgrade",
      });
    });

    it("refuses a rollback that is not lower", () => {
      expect(canPoint({ channel, artefact: bundle, rollback: true })).toMatchObject({
        ok: false,
        reason: "rollback-not-lower",
      });
    });

    it("compares native builds by build number", () => {
      const nativeChannel = {
        ...channel,
        currentVersion: { versionName: "9.0.0", versionCode: 12 },
      };
      expect(canPoint({ channel: nativeChannel, artefact: native })).toMatchObject({
        ok: false,
        reason: "downgrade-needs-rollback",
      });
    });
  });
});
