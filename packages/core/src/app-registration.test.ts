import { describe, expect, it } from "vite-plus/test";
import {
  adoptionReparents,
  decideAppRegistration,
  describeAppConflict,
  type AppRegistrationFacts,
  type ExistingApp,
} from "./app-registration.js";

const MINE = "org-mine";
const THEIRS = "org-theirs";

const existing = (organizationId: string | null): ExistingApp => ({
  id: "app-uuid",
  app_id: "com.ayb.lowmaro",
  organization_id: organizationId,
});

const facts = (over: Partial<AppRegistrationFacts> = {}): AppRegistrationFacts => ({
  appId: "com.ayb.lowmaro",
  requestedOrganizationId: MINE,
  ...over,
});

describe("decideAppRegistration", () => {
  it("creates when the bundle id is free", () => {
    expect(decideAppRegistration(facts())).toEqual({ kind: "create" });
  });

  it("creates when the lookup returned null rather than undefined", () => {
    expect(decideAppRegistration(facts({ existing: null }))).toEqual({ kind: "create" });
  });

  it("adopts a row in the requested organisation, so init is idempotent", () => {
    expect(decideAppRegistration(facts({ existing: existing(MINE) }))).toEqual({
      kind: "adopt",
      app: existing(MINE),
      reason: "same-organisation",
    });
  });

  it("adopts a row in another organisation the caller was granted access to", () => {
    const decision = decideAppRegistration(
      facts({ existing: existing(THEIRS), callerHasDirectPermission: true }),
    );

    expect(decision).toMatchObject({ kind: "adopt", reason: "direct-permission" });
  });

  it("adopts a row whose organisation was deleted", () => {
    const decision = decideAppRegistration(
      facts({ existing: existing(THEIRS), existingOrganizationExists: false }),
    );

    expect(decision).toMatchObject({ kind: "adopt", reason: "orphaned" });
  });

  it("adopts a row with no organisation at all", () => {
    expect(decideAppRegistration(facts({ existing: existing(null) }))).toMatchObject({
      kind: "adopt",
      reason: "orphaned",
    });
  });

  it("refuses a row owned by an organisation the caller is not in", () => {
    const decision = decideAppRegistration(
      facts({ existing: existing(THEIRS), existingOrganizationExists: true }),
    );

    expect(decision).toEqual({ kind: "conflict", app: existing(THEIRS) });
  });

  it("does not treat an unknown organisation as orphaned", () => {
    // existingOrganizationExists undefined means not checked, which must not be
    // read as "no owner" - that would hand another organisation's app away.
    expect(decideAppRegistration(facts({ existing: existing(THEIRS) }))).toMatchObject({
      kind: "conflict",
    });
  });

  it("prefers a direct grant over refusing", () => {
    const decision = decideAppRegistration(
      facts({
        existing: existing(THEIRS),
        existingOrganizationExists: true,
        callerHasDirectPermission: true,
      }),
    );

    expect(decision).toMatchObject({ kind: "adopt" });
  });

  it("reparents only an orphan", () => {
    expect(adoptionReparents("orphaned")).toBe(true);
    expect(adoptionReparents("same-organisation")).toBe(false);
    expect(adoptionReparents("direct-permission")).toBe(false);
  });

  it("names the identifier in the conflict message", () => {
    expect(describeAppConflict("com.ayb.lowmaro")).toContain("com.ayb.lowmaro");
  });
});
