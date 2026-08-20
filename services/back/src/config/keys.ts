/**
 * Supabase API key resolution.
 *
 * Supabase replaced its JWT keys with a new pair, and the old ones are on the
 * way out - the documentation states they "will be deprecated by the end of
 * 2026":
 *
 *   legacy `anon`          ->  publishable key, `sb_publishable_...`
 *   legacy `service_role`  ->  secret key,      `sb_secret_...`
 *
 * The privilege model is what matters here, not the naming. A publishable key
 * is subject to row level security exactly as `anon` was; a secret key holds
 * the `BYPASSRLS` attribute and has full access. This server writes to tables
 * with RLS enabled whose policies are all keyed on an authenticated dashboard
 * user (`can_access_app`), and it never forwards a user's JWT to Supabase - so
 * its own writes only succeed under a secret key. Access control for those
 * writes lives in this service's middleware, not in RLS.
 *
 * Both new and legacy names are accepted so an environment can be migrated
 * without a deploy in between. Legacy values are used and logged, never
 * rejected.
 *
 * Kept free of imports so it can be tested without loading `@/config`, which
 * validates the whole environment at import time.
 */

export interface SupabaseKeyEnv {
  SUPABASE_PUBLISHABLE_KEY?: string | undefined;
  SUPABASE_SECRET_KEY?: string | undefined;
  /** Legacy `anon` JWT. */
  SUPABASE_KEY?: string | undefined;
  /** Legacy `service_role` JWT. */
  SUPABASE_SERVICE_KEY?: string | undefined;
}

export interface ResolvedSupabaseKeys {
  /** Low-privilege key, subject to row level security. Optional: nothing server-side needs it. */
  publishableKey: string | undefined;
  /** Privileged key. Required - every write this server performs depends on it. */
  secretKey: string;
  /** Which of the two came from a deprecated variable, for the startup warning. */
  legacy: Array<"publishable" | "secret">;
}

/**
 * A legacy key is a JWT, so it is three base64url segments starting with the
 * encoded `{"alg":...` header. The new keys are opaque and prefixed.
 */
export function isLegacyJwtKey(value: string | undefined): boolean {
  if (!value) return false;
  return value.startsWith("eyJ") && value.split(".").length === 3;
}

/** True for `sb_secret_...`, the only key type that bypasses row level security. */
export function isSecretKey(value: string | undefined): boolean {
  return Boolean(value?.startsWith("sb_secret_"));
}

/** True for `sb_publishable_...`, which is safe to ship in a client. */
export function isPublishableKey(value: string | undefined): boolean {
  return Boolean(value?.startsWith("sb_publishable_"));
}

export class SupabaseKeyError extends Error {}

const MISSING_SECRET_KEY = [
  "No Supabase secret key configured.",
  "Set SUPABASE_SECRET_KEY to an sb_secret_... key from Settings > API Keys.",
  "This server writes to tables with row level security enabled, and only a",
  "secret key carries BYPASSRLS - with a publishable key those writes are",
  "silently rejected and no device or update log is ever recorded.",
  "SUPABASE_SERVICE_KEY (the deprecated service_role JWT) is still accepted.",
].join(" ");

export function resolveSupabaseKeys(env: SupabaseKeyEnv): ResolvedSupabaseKeys {
  const legacy: Array<"publishable" | "secret"> = [];

  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_KEY || undefined;
  if (!env.SUPABASE_PUBLISHABLE_KEY && env.SUPABASE_KEY) legacy.push("publishable");

  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_KEY;
  if (!env.SUPABASE_SECRET_KEY && env.SUPABASE_SERVICE_KEY) legacy.push("secret");

  if (!secretKey) {
    throw new SupabaseKeyError(MISSING_SECRET_KEY);
  }

  return { publishableKey, secretKey, legacy };
}

/**
 * Startup warnings: which variables are deprecated, and whether a key looks
 * like the wrong type for the slot it was put in.
 */
export function keyWarnings(resolved: ResolvedSupabaseKeys): string[] {
  const warnings: string[] = [];

  if (resolved.legacy.includes("secret")) {
    warnings.push(
      "SUPABASE_SERVICE_KEY is a deprecated service_role JWT. Create a secret key " +
        "(Settings > API Keys) and set SUPABASE_SECRET_KEY, then delete the legacy keys - " +
        "creating new ones does not disable the old.",
    );
  }

  if (resolved.legacy.includes("publishable")) {
    warnings.push(
      "SUPABASE_KEY is a deprecated anon JWT. Replace it with SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  // A publishable key in the secret slot is the failure this module exists to
  // prevent: it validates, connects, and then silently writes nothing.
  if (isPublishableKey(resolved.secretKey)) {
    warnings.push(
      "The configured secret key is a publishable key (sb_publishable_...). It is subject " +
        "to row level security, so this server's writes will be rejected. Use an sb_secret_... key.",
    );
  }

  if (resolved.publishableKey && isSecretKey(resolved.publishableKey)) {
    warnings.push(
      "A secret key is configured as the publishable key. Never expose that value to a client.",
    );
  }

  return warnings;
}
