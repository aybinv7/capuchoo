import { describe, expect, it } from "vite-plus/test";
import {
  canAssignDevice,
  canChangeOwnership,
  canCreateApp,
  canDeleteRelease,
  canDeliver,
  canEditRelease,
  canManageChannels,
  canManageMembers,
  hasAppRole,
  hasOrgRole,
  roleToDeliver,
} from "./roles";

describe("app roles", () => {
  it("orders viewer < tester < developer < admin", () => {
    expect(hasAppRole("admin", "developer")).toBe(true);
    expect(hasAppRole("developer", "developer")).toBe(true);
    expect(hasAppRole("tester", "developer")).toBe(false);
    expect(hasAppRole(null, "viewer")).toBe(false);
    expect(hasAppRole(undefined, "viewer")).toBe(false);
  });

  it("needs prod_role for prod and developer everywhere else", () => {
    expect(roleToDeliver("prod", "admin")).toBe("admin");
    expect(roleToDeliver("prod", "developer")).toBe("developer");
    expect(roleToDeliver("staging", "admin")).toBe("developer");
    expect(roleToDeliver("dev", "admin")).toBe("developer");
  });
});

describe("delivery gates", () => {
  it("lets a developer deliver to prod only when the app allows it", () => {
    expect(canDeliver("developer", "prod", "admin").ok).toBe(false);
    expect(canDeliver("developer", "prod", "developer").ok).toBe(true);
    expect(canDeliver("developer", "staging", "admin").ok).toBe(true);
    expect(canDeliver("admin", "prod", "admin").ok).toBe(true);
  });

  it("says why it refuses", () => {
    const gate = canDeliver("tester", "dev", "admin");
    expect(gate).toEqual({
      ok: false,
      reason: "Delivering to dev requires developer; you are tester.",
    });
    const none = canDeliver(null, "prod", "admin");
    expect(!none.ok && none.reason).toContain("no role");
  });

  it("gates release edits by the flavour's deliver role", () => {
    expect(canEditRelease("developer", "staging", "admin").ok).toBe(true);
    expect(canEditRelease("developer", "prod", "admin").ok).toBe(false);
    expect(canEditRelease("developer", "prod", "developer").ok).toBe(true);
    expect(canEditRelease("viewer", null, "admin").ok).toBe(false);
  });

  it("gates device assignment by the target channel's environment", () => {
    expect(canAssignDevice("developer", "prod", "admin").ok).toBe(false);
    expect(canAssignDevice("developer", "dev", "admin").ok).toBe(true);
    expect(canAssignDevice("developer", null, "admin").ok).toBe(true);
    expect(canAssignDevice("tester", null, "admin").ok).toBe(false);
  });

  it("keeps channel management and deletions for admins", () => {
    expect(canManageChannels("admin").ok).toBe(true);
    expect(canManageChannels("developer").ok).toBe(false);
    expect(canDeleteRelease("developer").ok).toBe(false);
  });
});

describe("organization gates", () => {
  it("orders member < admin < owner", () => {
    expect(hasOrgRole("owner", "admin")).toBe(true);
    expect(hasOrgRole("member", "admin")).toBe(false);
    expect(hasOrgRole(null, "member")).toBe(false);
  });

  it("lets admins manage members and only owners touch ownership", () => {
    expect(canManageMembers("admin").ok).toBe(true);
    expect(canManageMembers("member").ok).toBe(false);
    expect(canChangeOwnership("admin").ok).toBe(false);
    expect(canChangeOwnership("owner").ok).toBe(true);
    expect(canCreateApp("member").ok).toBe(false);
  });
});
