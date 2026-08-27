import { describe, expect, it } from "vite-plus/test";
import {
  hiddenCommands,
  isBlocked,
  labelFor,
  resolveOnboarding,
  type OnboardingFacts,
} from "./onboarding.js";

const ready: OnboardingFacts = {
  signedIn: true,
  inAppDirectory: true,
  linked: true,
  updaterInstalled: true,
  channels: [{ name: "prod", servingBundle: true }],
};

describe("resolveOnboarding", () => {
  it("puts signing in ahead of everything", () => {
    expect(resolveOnboarding({ ...ready, signedIn: false })).toMatchObject({
      stage: "signed-out",
      next: { command: "auth:login" },
    });
  });

  // Even a fully broken app directory is not the problem when there is no
  // credential: nothing can be checked without one.
  it("reports signed-out even when everything else is missing too", () => {
    expect(
      resolveOnboarding({
        signedIn: false,
        inAppDirectory: false,
        linked: false,
        updaterInstalled: false,
      }).stage,
    ).toBe("signed-out");
  });

  it("recommends nothing outside an app directory", () => {
    expect(resolveOnboarding({ ...ready, inAppDirectory: false })).toEqual({
      stage: "not-an-app",
      next: null,
    });
  });

  // One command, so both stages point at the same place. `setup` used to be a
  // second command whose own advice was to go and run `init`.
  it("sends an unlinked app to init", () => {
    expect(resolveOnboarding({ ...ready, linked: false })).toMatchObject({
      stage: "unlinked",
      next: { command: "init" },
    });
  });

  it("sends a linked app without the runtime back to init", () => {
    expect(resolveOnboarding({ ...ready, updaterInstalled: false })).toMatchObject({
      stage: "incomplete",
      next: { command: "init", label: "Finish setting up" },
    });
  });

  it("sends an app with no channels to channel create", () => {
    expect(resolveOnboarding({ ...ready, channels: [] })).toMatchObject({
      stage: "no-channels",
      next: { command: "channel:create" },
    });
  });

  it("sends channels that serve nothing to a first deploy", () => {
    expect(
      resolveOnboarding({ ...ready, channels: [{ name: "prod", servingBundle: false }] }),
    ).toMatchObject({ stage: "nothing-served", next: { command: "deploy:ota" } });
  });

  it("is ready when at least one channel serves something", () => {
    expect(resolveOnboarding(ready)).toMatchObject({ stage: "ready" });
  });

  /**
   * Channels are the only fact needing the network, against a backend that
   * sleeps. An unknown value must never be reported as "no channels" - that
   * would send someone to create channels they already have.
   */
  it.each([null, undefined])("treats %s channels as unknown, not as none", (channels) => {
    expect(resolveOnboarding({ ...ready, channels }).stage).toBe("ready");
  });

  it("still reports local problems when channels are unknown", () => {
    expect(resolveOnboarding({ ...ready, channels: null, linked: false }).stage).toBe("unlinked");
  });

  it("always explains why, wherever it points", () => {
    for (const facts of [
      { ...ready, signedIn: false },
      { ...ready, linked: false },
      { ...ready, updaterInstalled: false },
      { ...ready, channels: [] },
      ready,
    ]) {
      const { next } = resolveOnboarding(facts);
      expect(next?.why).toBeTruthy();
    }
  });
});

describe("hiddenCommands", () => {
  it("hides sign-in once signed in, and the rest until then", () => {
    expect(hiddenCommands(ready)).toContain("auth:login");
    expect(hiddenCommands({ ...ready, signedIn: false })).toContain("auth:logout");
    expect(hiddenCommands({ ...ready, signedIn: false })).not.toContain("auth:login");
  });
});

describe("labelFor", () => {
  it("says re-check once an app is already set up", () => {
    // Not "re-run": a second run is a no-op plus a verification, and a label
    // implying it will redo the setup is why nobody ran it again.
    expect(labelFor("init", ready)).toBe("init (re-check)");
  });

  it("keeps the default label on a fresh app", () => {
    const fresh = { ...ready, linked: false, updaterInstalled: false };
    expect(labelFor("init", fresh)).toBeNull();
  });

  it("leaves every other command alone", () => {
    expect(labelFor("deploy:ota", ready)).toBeNull();
  });
});

describe("isBlocked", () => {
  it("narrows the menu only when signed out", () => {
    expect(isBlocked(resolveOnboarding({ ...ready, signedIn: false }))).toBe(true);
    expect(isBlocked(resolveOnboarding(ready))).toBe(false);
    expect(isBlocked(resolveOnboarding({ ...ready, linked: false }))).toBe(false);
  });
});
