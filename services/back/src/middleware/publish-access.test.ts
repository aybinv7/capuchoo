import { describe, expect, it } from "vite-plus/test";
import { decidePublishAccess, type PublishRequest } from "./publish-access";

const base: PublishRequest = {
  userId: "user-1",
  bundleId: "com.efficy.app",
  appUuid: "app-uuid",
  appRole: "developer",
};

describe("decidePublishAccess", () => {
  it("allows a developer", () => {
    expect(decidePublishAccess(base)).toEqual({
      allow: true,
      appUuid: "app-uuid",
      role: "developer",
    });
  });

  it("allows an admin", () => {
    expect(decidePublishAccess({ ...base, appRole: "admin" })).toMatchObject({ allow: true });
  });

  /**
   * The hole this guard closes. Until now `/admin/upload` checked only that the
   * caller was authenticated and that an app-scoped key matched, so any account
   * holding an unscoped key could ship a required update to an app it was only
   * a viewer on.
   */
  it.each(["tester", "viewer"] as const)("refuses a %s", (role) => {
    const decision = decidePublishAccess({ ...base, appRole: role });

    expect(decision).toMatchObject({ allow: false, status: 403 });
    expect(decision).toHaveProperty("reason", expect.stringContaining(role));
  });

  it("refuses an account with no grant at all", () => {
    expect(decidePublishAccess({ ...base, appRole: null })).toEqual({
      allow: false,
      status: 403,
      reason: "No access to this app",
    });
  });

  it.each(["owner", "admin"] as const)("treats an org %s as an app admin", (orgRole) => {
    expect(decidePublishAccess({ ...base, appRole: null, orgRole })).toEqual({
      allow: true,
      appUuid: "app-uuid",
      role: "admin",
    });
  });

  // Membership alone is not permission, or every member of an organisation could
  // publish to every app in it.
  it("gives a plain org member nothing", () => {
    expect(decidePublishAccess({ ...base, appRole: null, orgRole: "member" })).toMatchObject({
      allow: false,
      status: 403,
    });
  });

  /**
   * A direct grant is authoritative, matching checkAppAccess: the org fallback
   * applies only when there is no grant. So an explicit downgrade denies an org
   * owner, which is the point of being able to make one.
   */
  it("lets an explicit grant deny someone the org would allow", () => {
    expect(decidePublishAccess({ ...base, appRole: "viewer", orgRole: "owner" })).toMatchObject({
      allow: false,
      status: 403,
    });
  });

  describe("order of checks", () => {
    it("reports an unauthenticated caller before anything else", () => {
      expect(decidePublishAccess({ userId: undefined, bundleId: undefined })).toEqual({
        allow: false,
        status: 401,
        reason: "Unauthorized",
      });
    });

    it("asks for app_id before looking anything up", () => {
      expect(decidePublishAccess({ ...base, bundleId: undefined })).toMatchObject({
        allow: false,
        status: 400,
      });
    });

    it("reports an unknown bundle id as 404, naming it", () => {
      const decision = decidePublishAccess({ ...base, appUuid: null });

      expect(decision).toMatchObject({ allow: false, status: 404 });
      expect(decision).toHaveProperty("reason", expect.stringContaining("com.efficy.app"));
    });

    // A restricted key gets the message naming its restriction rather than a
    // role complaint, because the restriction is the thing to fix.
    it("checks key scope before role", () => {
      expect(
        decidePublishAccess({ ...base, appRole: "viewer", keyAppId: "another-app" }),
      ).toMatchObject({ allow: false, reason: "Forbidden: API key restricted to another app" });
    });

    it("lets a correctly scoped key through to the role check", () => {
      expect(decidePublishAccess({ ...base, keyAppId: "app-uuid" })).toMatchObject({
        allow: true,
      });
    });
  });

  /**
   * The point of a cap: a CI credential that publishes but cannot administer,
   * issued by someone who can do both.
   */
  describe("a capped key", () => {
    it("still publishes when capped at developer", () => {
      expect(
        decidePublishAccess({ ...base, appRole: "admin", keyRole: "developer" }),
      ).toMatchObject({ allow: true, role: "developer" });
    });

    it.each(["tester", "viewer"] as const)("cannot publish when capped at %s", (keyRole) => {
      const decision = decidePublishAccess({ ...base, appRole: "admin", keyRole });

      expect(decision).toMatchObject({ allow: false, status: 403 });
      expect(decision).toHaveProperty("reason", expect.stringContaining("capped"));
    });

    // Reading "this account is admin" while holding a viewer-capped key would
    // send someone to fix the wrong thing.
    it("blames the key rather than the account", () => {
      const decision = decidePublishAccess({ ...base, appRole: "admin", keyRole: "viewer" });
      expect(decision).toHaveProperty("reason", expect.not.stringContaining("this account"));
    });

    // A cap can only reduce. Otherwise handing over a key would grant rights.
    it("cannot raise a viewer account", () => {
      expect(decidePublishAccess({ ...base, appRole: "viewer", keyRole: "admin" })).toMatchObject({
        allow: false,
      });
    });

    it("changes nothing when uncapped", () => {
      expect(decidePublishAccess({ ...base, keyRole: null })).toMatchObject({ allow: true });
    });

    it("caps the org-admin fallback too", () => {
      expect(
        decidePublishAccess({ ...base, appRole: null, orgRole: "owner", keyRole: "viewer" }),
      ).toMatchObject({ allow: false });
    });
  });
});
