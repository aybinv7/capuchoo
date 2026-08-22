import { describe, expect, it } from "vite-plus/test";
import { canPublishTo, type UserProfile } from "./cloud.js";

const profile = (credential?: UserProfile["credential"]): UserProfile => ({
  user: { id: "u1", email: "dev@example.com" },
  organizations: [],
  apps: [],
  ...(credential ? { credential } : {}),
});

describe("canPublishTo", () => {
  it("allows an unscoped key to publish to any app", () => {
    expect(canPublishTo(profile({ type: "api_key", app_id: null }), "app-1")).toBe(true);
  });

  it("allows a scoped key to publish to its own app", () => {
    expect(canPublishTo(profile({ type: "api_key", app_id: "app-1" }), "app-1")).toBe(true);
  });

  it("refuses a scoped key on another app", () => {
    expect(canPublishTo(profile({ type: "api_key", app_id: "app-2" }), "app-1")).toBe(false);
  });

  // A backend that predates the `credential` field reports nothing, and blocking
  // every deploy against it would be worse than the 403 this check replaces.
  it("assumes the best when the backend reports no scope", () => {
    expect(canPublishTo(profile(), "app-1")).toBe(true);
  });
});
