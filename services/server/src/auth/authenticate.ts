import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv, Deps } from "../http/context";
import { sha256Hex } from "../lib/crypto";
import { forbidden } from "../lib/errors";
import { findApiKey, touchApiKey } from "../repositories/api-keys";
import { extendSession, findSession } from "../repositories/sessions";
import type { Principal } from "./principal";
import { API_KEY_PREFIX, SESSION_COOKIE, SESSION_PREFIX, readCredential } from "./tokens";

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const keyTouches = new Map<string, number>();

/** Resolves a token to a principal; null for anything unknown, expired, revoked or disabled. */
export async function resolvePrincipal(deps: Deps, token: string): Promise<Principal | null> {
  const now = deps.now();
  const hash = sha256Hex(token);

  if (token.startsWith(API_KEY_PREFIX)) {
    const key = await findApiKey(deps.db, hash, now);
    if (!key) return null;
    const last = keyTouches.get(key.keyId) ?? 0;
    if (now.getTime() - last > TOUCH_INTERVAL_MS) {
      keyTouches.set(key.keyId, now.getTime());
      void touchApiKey(deps.db, key.keyId, now).catch(() => undefined);
    }
    return {
      userId: key.userId,
      email: key.email,
      fullName: key.fullName,
      isInstanceAdmin: key.isInstanceAdmin,
      credential: { type: "api_key", keyId: key.keyId, appId: key.appId, role: key.role },
    };
  }

  if (token.startsWith(SESSION_PREFIX)) {
    const session = await findSession(deps.db, hash, now);
    if (!session) return null;
    if (now.getTime() - new Date(session.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
      const expiresAt = new Date(now.getTime() + deps.config.SESSION_TTL_DAYS * 86_400_000);
      void extendSession(deps.db, session.sessionId, now, expiresAt).catch(() => undefined);
    }
    return {
      userId: session.userId,
      email: session.email,
      fullName: session.fullName,
      isInstanceAdmin: session.isInstanceAdmin,
      credential: { type: "session", sessionId: session.sessionId },
    };
  }

  return null;
}

function sameOrigin(origin: string, host: string | undefined, allowed: string[]): boolean {
  try {
    const url = new URL(origin);
    return url.host === host || allowed.includes(url.origin);
  } catch {
    return false;
  }
}

/**
 * Attaches the caller, if any. A cookie session on a state-changing request must come from this
 * origin (or an allowed one): that is the CSRF defence; header credentials cannot be sent cross-site.
 */
export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const deps = c.get("deps");
  const credential = readCredential({
    authorization: c.req.header("authorization"),
    apiKeyHeader: c.req.header("x-api-key"),
    cookie: getCookie(c, SESSION_COOKIE),
  });

  if (!credential) {
    c.set("principal", null);
    return next();
  }

  if (credential.from === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin") ?? c.req.header("referer");
    if (!origin || !sameOrigin(origin, c.req.header("host"), deps.config.allowedOrigins)) {
      throw forbidden("Cross-site request refused", "csrf");
    }
  }

  c.set("principal", await resolvePrincipal(deps, credential.token));
  return next();
};
