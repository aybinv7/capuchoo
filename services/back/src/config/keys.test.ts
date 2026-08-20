import { describe, expect, it } from "vite-plus/test";
import {
  isLegacyJwtKey,
  isPublishableKey,
  isSecretKey,
  keyWarnings,
  resolveSupabaseKeys,
  SupabaseKeyError,
} from "./keys";

const NEW = {
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_aaaaaaaaaaaa",
  SUPABASE_SECRET_KEY: "sb_secret_bbbbbbbbbbbb",
};

// Shape only - three base64url segments, no real key material.
const LEGACY_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl";

describe("resolveSupabaseKeys", () => {
  it("prefers the current names and reports no legacy use", () => {
    const resolved = resolveSupabaseKeys(NEW);

    expect(resolved.publishableKey).toBe(NEW.SUPABASE_PUBLISHABLE_KEY);
    expect(resolved.secretKey).toBe(NEW.SUPABASE_SECRET_KEY);
    expect(resolved.legacy).toEqual([]);
  });

  it("accepts the deprecated names so an environment can migrate in place", () => {
    const resolved = resolveSupabaseKeys({
      SUPABASE_KEY: LEGACY_JWT,
      SUPABASE_SERVICE_KEY: "legacy-service-role",
    });

    expect(resolved.publishableKey).toBe(LEGACY_JWT);
    expect(resolved.secretKey).toBe("legacy-service-role");
    expect(resolved.legacy).toEqual(["publishable", "secret"]);
  });

  it("lets a half-migrated environment work", () => {
    const resolved = resolveSupabaseKeys({
      SUPABASE_SECRET_KEY: NEW.SUPABASE_SECRET_KEY,
      SUPABASE_KEY: LEGACY_JWT,
    });

    expect(resolved.secretKey).toBe(NEW.SUPABASE_SECRET_KEY);
    expect(resolved.legacy).toEqual(["publishable"]);
  });

  it("does not require a publishable key - nothing server-side uses one", () => {
    expect(
      resolveSupabaseKeys({ SUPABASE_SECRET_KEY: NEW.SUPABASE_SECRET_KEY }).publishableKey,
    ).toBeUndefined();
  });

  it("refuses to start without a secret key, rather than writing nothing", () => {
    expect(() => resolveSupabaseKeys({ SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" })).toThrow(
      SupabaseKeyError,
    );
    expect(() => resolveSupabaseKeys({})).toThrow(/row level security/);
  });
});

describe("key shape helpers", () => {
  it("identifies legacy JWTs by shape", () => {
    expect(isLegacyJwtKey(LEGACY_JWT)).toBe(true);
    expect(isLegacyJwtKey(NEW.SUPABASE_SECRET_KEY)).toBe(false);
    expect(isLegacyJwtKey(undefined)).toBe(false);
    expect(isLegacyJwtKey("eyJ-not-a-jwt")).toBe(false);
  });

  it("distinguishes the two new prefixes", () => {
    expect(isSecretKey(NEW.SUPABASE_SECRET_KEY)).toBe(true);
    expect(isSecretKey(NEW.SUPABASE_PUBLISHABLE_KEY)).toBe(false);
    expect(isPublishableKey(NEW.SUPABASE_PUBLISHABLE_KEY)).toBe(true);
    expect(isPublishableKey(NEW.SUPABASE_SECRET_KEY)).toBe(false);
  });
});

describe("keyWarnings", () => {
  it("says nothing when both keys are current", () => {
    expect(keyWarnings(resolveSupabaseKeys(NEW))).toEqual([]);
  });

  it("names each deprecated variable in use", () => {
    const warnings = keyWarnings(
      resolveSupabaseKeys({ SUPABASE_KEY: LEGACY_JWT, SUPABASE_SERVICE_KEY: "legacy" }),
    );

    expect(warnings.join(" ")).toContain("SUPABASE_SERVICE_KEY");
    expect(warnings.join(" ")).toContain("SUPABASE_KEY");
  });

  it("catches a publishable key put in the secret slot - the silent-failure case", () => {
    const warnings = keyWarnings({
      publishableKey: undefined,
      secretKey: "sb_publishable_oops",
      legacy: [],
    });

    expect(warnings.join(" ")).toContain("row level security");
  });

  it("catches a secret key exposed as the publishable one", () => {
    const warnings = keyWarnings({
      publishableKey: NEW.SUPABASE_SECRET_KEY,
      secretKey: NEW.SUPABASE_SECRET_KEY,
      legacy: [],
    });

    expect(warnings.join(" ")).toContain("Never expose");
  });
});

describe("keyWarnings: renaming is not rotating", () => {
  it("flags a legacy JWT configured under the new secret name", () => {
    const warnings = keyWarnings({
      publishableKey: undefined,
      secretKey: LEGACY_JWT,
      legacy: [],
    });

    expect(warnings.join(" ")).toContain("does not rotate the credential");
  });

  it("does not repeat itself when the deprecated name is the source", () => {
    const warnings = keyWarnings(
      resolveSupabaseKeys({ SUPABASE_KEY: LEGACY_JWT, SUPABASE_SERVICE_KEY: LEGACY_JWT }),
    );

    expect(warnings.filter((w) => w.includes("sb_publishable_"))).toHaveLength(0);
  });
});
