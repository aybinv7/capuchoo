import { describe, expect, it } from "vite-plus/test";
import {
  describeFlavourMismatch,
  describeUploadFlavourMismatch,
  isFlavour,
  isFlavourAllowed,
  toAppIdentity,
} from "./app-identity.js";

describe("isFlavour", () => {
  it("accepts the three flavours and nothing else", () => {
    expect(isFlavour("prod")).toBe(true);
    expect(isFlavour("staging")).toBe(true);
    expect(isFlavour("dev")).toBe(true);
    expect(isFlavour("production")).toBe(false);
    expect(isFlavour("")).toBe(false);
    expect(isFlavour(null)).toBe(false);
    expect(isFlavour(undefined)).toBe(false);
  });
});

describe("toAppIdentity", () => {
  it("keeps a recognised flavour", () => {
    expect(
      toAppIdentity({ app_id: "uuid", bundle_id: "com.acme.app.dev", flavour: "dev" }),
    ).toEqual({ appId: "uuid", bundleId: "com.acme.app.dev", flavour: "dev" });
  });

  it("reads a missing flavour as shared, not as prod", () => {
    // The whole point: absent means "no claim", and defaulting it to prod would
    // reintroduce the bug - every un-migrated row would refuse dev channels.
    expect(toAppIdentity({ app_id: "uuid", bundle_id: "com.ayb.lowmaro" }).flavour).toBeNull();
    expect(
      toAppIdentity({ app_id: "uuid", bundle_id: "com.ayb.lowmaro", flavour: null }).flavour,
    ).toBeNull();
  });

  it("reads a corrupt flavour as shared rather than throwing", () => {
    expect(
      toAppIdentity({ app_id: "uuid", bundle_id: "x", flavour: "production" }).flavour,
    ).toBeNull();
  });
});

describe("isFlavourAllowed", () => {
  it("allows a shared identifier onto any channel", () => {
    // Lowmaro: one identifier, three flavours, three channels. The old rule
    // could not serve its dev channel at all.
    expect(isFlavourAllowed(null, "prod")).toBe(true);
    expect(isFlavourAllowed(null, "staging")).toBe(true);
    expect(isFlavourAllowed(null, "dev")).toBe(true);
  });

  it("allows a matching claim", () => {
    expect(isFlavourAllowed("dev", "dev")).toBe(true);
    expect(isFlavourAllowed("prod", "prod")).toBe(true);
  });

  it("refuses a claim that contradicts the channel", () => {
    expect(isFlavourAllowed("dev", "prod")).toBe(false);
    expect(isFlavourAllowed("prod", "dev")).toBe(false);
    // No prod-onto-staging exception now that a claim is deliberate.
    expect(isFlavourAllowed("prod", "staging")).toBe(false);
  });

  it("allows anything onto a channel with no flavour bound", () => {
    expect(isFlavourAllowed("dev", null)).toBe(true);
    expect(isFlavourAllowed("dev", undefined)).toBe(true);
  });

  it("names both sides in the mismatch message", () => {
    const message = describeFlavourMismatch("com.acme.app.dev", "dev", "prod", "production");

    expect(message).toContain("com.acme.app.dev");
    expect(message).toContain("production");
  });

  it("names the channel and both flavours when an upload is refused", () => {
    const message = describeUploadFlavourMismatch("production", "prod", "dev");

    expect(message).toContain("production");
    expect(message).toContain("prod");
    expect(message).toContain("dev");
  });
});
