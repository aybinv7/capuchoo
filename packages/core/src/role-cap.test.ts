import { describe, expect, it } from "vite-plus/test";
import { canIssueCap, describeCap, effectiveRole, isAppRole, roleRank } from "./role-cap.js";

describe("roleRank", () => {
  it("orders roles by what they can do", () => {
    expect(roleRank("viewer")).toBeLessThan(roleRank("tester"));
    expect(roleRank("tester")).toBeLessThan(roleRank("developer"));
    expect(roleRank("developer")).toBeLessThan(roleRank("admin"));
  });
});

describe("isAppRole", () => {
  it.each(["admin", "developer", "tester", "viewer"])("accepts %s", (role) => {
    expect(isAppRole(role)).toBe(true);
  });

  it.each(["owner", "", "Admin", null, undefined, 3])("rejects %s", (value) => {
    expect(isAppRole(value)).toBe(false);
  });
});

describe("effectiveRole", () => {
  it("is the account's role when the key is uncapped", () => {
    expect(effectiveRole("admin", null)).toBe("admin");
    expect(effectiveRole("admin", undefined)).toBe("admin");
  });

  /**
   * The point of a cap: a CI credential that can publish but not administer,
   * even though the person who made it is an admin.
   */
  it("lowers an admin to the cap", () => {
    expect(effectiveRole("admin", "developer")).toBe("developer");
  });

  // A cap can only ever reduce. Otherwise handing someone a key would be a way
  // to grant them rights they were never given.
  it("never raises the account's role", () => {
    expect(effectiveRole("viewer", "admin")).toBe("viewer");
    expect(effectiveRole("tester", "developer")).toBe("tester");
  });

  it("is nothing when the account has no role at all", () => {
    expect(effectiveRole(null, "admin")).toBeNull();
    expect(effectiveRole(undefined, undefined)).toBeNull();
  });

  it("is the same role when both agree", () => {
    expect(effectiveRole("developer", "developer")).toBe("developer");
  });
});

describe("canIssueCap", () => {
  it("lets a dashboard session mint anything", () => {
    expect(canIssueCap(null, "admin")).toBe(true);
    expect(canIssueCap(null, null)).toBe(true);
  });

  /**
   * Without this a cap is decoration: a developer key could mint an admin key,
   * or an uncapped one, and escalate out of its own limit.
   */
  it("refuses to mint above the caller's own cap", () => {
    expect(canIssueCap("developer", "admin")).toBe(false);
    expect(canIssueCap("viewer", "developer")).toBe(false);
  });

  it("refuses to mint an uncapped key from a capped one", () => {
    expect(canIssueCap("admin", null)).toBe(false);
  });

  it("allows the same cap or weaker", () => {
    expect(canIssueCap("developer", "developer")).toBe(true);
    expect(canIssueCap("developer", "viewer")).toBe(true);
  });
});

describe("describeCap", () => {
  it("says whether a cap can publish", () => {
    expect(describeCap("admin")).toContain("may publish");
    expect(describeCap("developer")).toContain("may publish");
    expect(describeCap("tester")).toContain("may not publish");
    expect(describeCap("viewer")).toContain("may not publish");
  });

  it("describes an uncapped key", () => {
    expect(describeCap(null)).toContain("account's own rights");
  });
});
