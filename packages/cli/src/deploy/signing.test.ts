import { describe, expect, it } from "vite-plus/test";
import type { SigningStatus } from "../pipeline/android-signing.js";
import type { ChannelClass } from "./channel-class.js";
import { decideSigning, type SigningFacts } from "./signing.js";

const PROD: ChannelClass = { name: "prod", environment: "prod", kind: "release" };
const CLIENT: ChannelClass = { name: "prod-acme", environment: "prod", kind: "client" };
const STAGING: ChannelClass = { name: "staging", environment: "staging", kind: "release" };
const DEV: ChannelClass = { name: "dev", environment: "dev", kind: "release" };

const READY: SigningStatus = { kind: "ready", configName: "release", storeFile: "k.jks" };
const INCOMPLETE: SigningStatus = {
  kind: "unconfigured",
  configName: "release",
  missing: ["RELEASE_STORE_FILE"],
};

function facts(overrides: Partial<SigningFacts>): SigningFacts {
  return {
    kind: "native",
    platform: "android",
    channel: STAGING,
    interactive: false,
    allowUnsigned: false,
    state: INCOMPLETE,
    ...overrides,
  };
}

describe("decideSigning with incomplete release signing", () => {
  it.each([PROD, CLIENT])(
    "refuses $name non-interactively instead of building debug",
    (channel) => {
      expect(decideSigning(facts({ channel }))).toMatchObject({
        kind: "refuse",
        message: expect.stringContaining("RELEASE_STORE_FILE"),
      });
    },
  );

  it.each([PROD, CLIENT])("refuses $name even at an interactive prompt", (channel) => {
    expect(decideSigning(facts({ channel, interactive: true })).kind).toBe("refuse");
  });

  it("refuses an explicit --type release on any channel", () => {
    expect(decideSigning(facts({ channel: DEV, requested: "release" })).kind).toBe("refuse");
    expect(
      decideSigning(facts({ channel: STAGING, requested: "release", interactive: true })).kind,
    ).toBe("refuse");
  });

  it("builds debug with a warning for a non-protected channel when no type was chosen", () => {
    expect(decideSigning(facts({ channel: STAGING }))).toMatchObject({
      kind: "build",
      choice: { buildType: "debug", allowUnsigned: false },
      warning: expect.stringContaining('"staging"'),
    });
  });

  it("offers an unsigned release only on a dev channel", () => {
    const labels = (channel: typeof DEV) => {
      const decision = decideSigning(facts({ channel, interactive: true }));
      return decision.kind === "ask" ? decision.choices.map((choice) => choice.label) : [];
    };
    expect(labels(DEV)).toEqual(["Debug", "Release, unsigned", "Cancel"]);
    expect(labels(STAGING)).toEqual(["Debug", "Cancel"]);
  });
});

describe("decideSigning flags", () => {
  it.each([PROD, CLIENT, STAGING])("refuses --allow-unsigned to $name", (channel) => {
    expect(decideSigning(facts({ channel, allowUnsigned: true, state: READY })).kind).toBe(
      "refuse",
    );
  });

  it("allows --allow-unsigned to a dev channel", () => {
    expect(decideSigning(facts({ channel: DEV, allowUnsigned: true }))).toEqual({
      kind: "build",
      choice: { buildType: "release", allowUnsigned: true },
    });
  });

  it("refuses a dev-named client channel for --allow-unsigned", () => {
    const client: ChannelClass = { name: "dev-acme", environment: "dev", kind: "client" };
    expect(decideSigning(facts({ channel: client, allowUnsigned: true })).kind).toBe("refuse");
  });

  it.each([PROD, CLIENT])("refuses --type debug to $name", (channel) => {
    expect(decideSigning(facts({ channel, requested: "debug", state: READY })).kind).toBe("refuse");
  });

  it("honours --type debug elsewhere", () => {
    expect(decideSigning(facts({ channel: STAGING, requested: "debug" }))).toEqual({
      kind: "build",
      choice: { buildType: "debug", allowUnsigned: false },
    });
  });
});

describe("decideSigning when signing is ready or irrelevant", () => {
  it("builds release for prod", () => {
    expect(decideSigning(facts({ channel: PROD, state: READY }))).toEqual({
      kind: "build",
      choice: { buildType: "release", allowUnsigned: false },
    });
  });

  it("leaves OTA deploys alone", () => {
    expect(decideSigning(facts({ kind: "ota", channel: PROD }))).toEqual({
      kind: "build",
      choice: { buildType: "release", allowUnsigned: false },
    });
  });

  it("treats a server without channel kinds as release channels", () => {
    const legacy: ChannelClass = { name: "beta", environment: "staging" };
    expect(decideSigning(facts({ channel: legacy })).kind).toBe("build");
  });
});
