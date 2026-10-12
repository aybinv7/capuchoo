import { describe, expect, it } from "vite-plus/test";
import { diffIdentifiers, flavourAppId, planFlavourIdentifiers } from "./identifier-plan.js";

const BASE = "com.example.field";

describe("flavourAppId", () => {
  it("keeps the base id for every flavour when shared", () => {
    expect(flavourAppId(BASE, "dev", "shared")).toBe(BASE);
    expect(flavourAppId(BASE, "prod", "shared")).toBe(BASE);
  });

  it("suffixes dev and staging, and leaves prod on the base id", () => {
    expect(flavourAppId(BASE, "dev", "suffixed")).toBe(`${BASE}.dev`);
    expect(flavourAppId(BASE, "staging", "suffixed")).toBe(`${BASE}.staging`);
    expect(flavourAppId(BASE, "prod", "suffixed")).toBe(BASE);
  });
});

describe("planFlavourIdentifiers", () => {
  it("registers one shared id when every flavour builds the same one", () => {
    expect(planFlavourIdentifiers({ dev: BASE, staging: BASE, prod: BASE }, BASE)).toEqual([
      { bundleId: BASE, flavour: null },
    ]);
  });

  it("falls back to the app's id for a flavour whose env file is absent", () => {
    expect(planFlavourIdentifiers({}, BASE)).toEqual([{ bundleId: BASE, flavour: null }]);
  });

  it("claims each flavour for its own id", () => {
    const plans = planFlavourIdentifiers(
      { dev: `${BASE}.dev`, staging: `${BASE}.staging`, prod: BASE },
      BASE,
    );
    expect(plans).toEqual(
      expect.arrayContaining([
        { bundleId: `${BASE}.dev`, flavour: "dev" },
        { bundleId: `${BASE}.staging`, flavour: "staging" },
        { bundleId: BASE, flavour: "prod" },
      ]),
    );
    expect(plans).toHaveLength(3);
  });

  it("claims no flavour for an id two flavours share", () => {
    const plans = planFlavourIdentifiers({ dev: `${BASE}.dev`, staging: BASE, prod: BASE }, BASE);
    expect(plans).toEqual(
      expect.arrayContaining([
        { bundleId: `${BASE}.dev`, flavour: "dev" },
        { bundleId: BASE, flavour: null },
      ]),
    );
  });
});

describe("diffIdentifiers", () => {
  it("returns only the ids the server does not have", () => {
    const diff = diffIdentifiers(
      [
        { bundleId: BASE, flavour: "prod" },
        { bundleId: `${BASE}.dev`, flavour: "dev" },
      ],
      [{ bundle_id: BASE, flavour: null }],
    );
    expect(diff.missing).toEqual([{ bundleId: `${BASE}.dev`, flavour: "dev" }]);
    expect(diff.conflicting).toEqual([]);
  });

  it("reports an id registered for another flavour instead of re-registering it", () => {
    const diff = diffIdentifiers(
      [{ bundleId: `${BASE}.dev`, flavour: "dev" }],
      [{ bundle_id: `${BASE}.dev`, flavour: "staging" }],
    );
    expect(diff.missing).toEqual([]);
    expect(diff.conflicting).toEqual([
      { plan: { bundleId: `${BASE}.dev`, flavour: "dev" }, registered: "staging" },
    ]);
  });
});
