import { describe, expect, it } from "vite-plus/test";
import { decideResourceAccess, type AccessRequest } from "./resource-access";

/**
 * These routes filtered by `id` alone before this middleware existed, so any
 * authenticated account could reach another organization's channel or bundle.
 * The cases below are the rule, not examples of it.
 */

const permitted = (over: Partial<AccessRequest> = {}): AccessRequest => ({
  userId: "user-1",
  resourceId: "chan-1",
  resourceAppId: "app-1",
  permitted: true,
  ...over,
});

describe("decideResourceAccess", () => {
  it("allows a permitted account and reports the app the row belongs to", () => {
    expect(decideResourceAccess(permitted(), "Channel")).toEqual({
      allow: true,
      appId: "app-1",
    });
  });

  it("refuses an account with no permission on the resource's app", () => {
    const decision = decideResourceAccess(permitted({ permitted: false }), "Channel");
    expect(decision).toMatchObject({ allow: false, status: 403 });
  });

  it("refuses an app-scoped key reaching another app's resource", () => {
    const decision = decideResourceAccess(
      // Permitted on the app, which is the point: ownership is not enough when
      // the credential itself is restricted.
      permitted({ keyAppId: "app-2" }),
      "Channel",
    );
    expect(decision).toEqual({
      allow: false,
      status: 403,
      reason: "This API key is restricted to another application.",
    });
  });

  it("allows an app-scoped key on its own app", () => {
    expect(decideResourceAccess(permitted({ keyAppId: "app-1" }), "Channel")).toEqual({
      allow: true,
      appId: "app-1",
    });
  });

  it("treats a missing row as not found, before any scope question", () => {
    const decision = decideResourceAccess(
      permitted({ resourceAppId: null, keyAppId: "app-2", permitted: false }),
      "Bundle",
    );
    expect(decision).toEqual({ allow: false, status: 404, reason: "Bundle not found" });
  });

  it("rejects an unauthenticated caller", () => {
    expect(decideResourceAccess(permitted({ userId: undefined }), "Channel")).toMatchObject({
      status: 401,
    });
  });

  it("rejects a route with no id", () => {
    expect(decideResourceAccess(permitted({ resourceId: undefined }), "Channel")).toMatchObject({
      status: 400,
    });
  });

  // `permitted` defaulting to undefined must not read as permission.
  it("denies when permission was never established", () => {
    const decision = decideResourceAccess(
      { userId: "user-1", resourceId: "chan-1", resourceAppId: "app-1" },
      "Channel",
    );
    expect(decision).toMatchObject({ allow: false, status: 403 });
  });
});

/**
 * Role enforcement on the mutating routes. `hasAppAccess` was a boolean, so any
 * grant at all was enough - a viewer could promote a bundle onto a channel,
 * which is how a release reaches devices.
 */
describe("decideResourceAccess with a required role", () => {
  const permitted = {
    userId: "user-1",
    resourceId: "row-1",
    resourceAppId: "app-1",
    permitted: true,
    requiredRoles: ["admin", "developer"] as const,
  };

  it.each(["admin", "developer"] as const)("allows a %s", (role) => {
    expect(decideResourceAccess({ ...permitted, role }, "Bundle")).toEqual({
      allow: true,
      appId: "app-1",
    });
  });

  it.each(["tester", "viewer"] as const)("refuses a %s and names the role", (role) => {
    const decision = decideResourceAccess({ ...permitted, role }, "Bundle");

    expect(decision).toMatchObject({ allow: false, status: 403 });
    expect(decision).toHaveProperty("reason", expect.stringContaining(role));
  });

  it("still refuses an account with no access before asking about roles", () => {
    expect(
      decideResourceAccess({ ...permitted, permitted: false, role: null }, "Bundle"),
    ).toMatchObject({ allow: false, reason: "No access to this bundle" });
  });

  // Read routes pass no requiredRoles, and must keep working for a viewer.
  it("allows any access when no role is required", () => {
    expect(
      decideResourceAccess(
        { userId: "u", resourceId: "r", resourceAppId: "app-1", permitted: true, role: "viewer" },
        "Channel",
      ),
    ).toMatchObject({ allow: true });
  });
});
