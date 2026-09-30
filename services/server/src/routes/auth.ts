import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { keyAppRestriction } from "../auth/principal";
import { SESSION_COOKIE } from "../auth/tokens";
import { readJson } from "../http/body";
import { principal, type AppContext, type AppEnv } from "../http/context";
import { serializeApp } from "../http/serializers";
import { sha256Hex } from "../lib/crypto";
import { notFound, tooManyRequests } from "../lib/errors";
import { RateLimiter } from "../lib/rate-limit";
import { listAccessibleApps } from "../repositories/apps";
import { findInvitation, listOrganizationsForUser } from "../repositories/organizations";
import { updateProfile } from "../repositories/users";
import {
  acceptInvitation,
  changePassword,
  login,
  logout,
  register,
  type IssuedSession,
} from "../services/auth-service";

function secureCookie(c: AppContext): boolean {
  const configured = c.get("deps").config.COOKIE_SECURE;
  if (configured !== undefined) return configured;
  return new URL(c.req.url).protocol === "https:" || c.req.header("x-forwarded-proto") === "https";
}

function withSession(c: AppContext, session: IssuedSession) {
  setCookie(c, SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: secureCookie(c),
    sameSite: "Lax",
    path: "/",
    expires: session.expiresAt,
  });
  return c.json({
    token: session.token,
    expires_at: session.expiresAt.toISOString(),
    user: session.user,
  });
}

/** Sign-in, sign-out, invitations and the caller's profile. */
export function authRoutes(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();
  const attempts = new RateLimiter(10, 10 / 900);

  const limit = (c: AppContext, email: unknown) => {
    const wait = Math.max(
      attempts.take(`ip:${c.get("clientIp")}`),
      typeof email === "string" ? attempts.take(`email:${email.toLowerCase()}`) : 0,
    );
    if (wait) throw tooManyRequests(wait);
  };

  router.post("/login", async (c) => {
    const body = await readJson(c, 8 * 1024);
    limit(c, body.email);
    const session = await login(c.get("deps"), {
      email: body.email,
      password: body.password,
      ip: c.get("clientIp"),
      userAgent: c.req.header("user-agent") ?? null,
    });
    return withSession(c, session);
  });

  router.post("/register", async (c) => {
    const body = await readJson(c, 8 * 1024);
    limit(c, body.email);
    const session = await register(c.get("deps"), {
      email: body.email,
      password: body.password,
      fullName: body.full_name,
      ip: c.get("clientIp"),
      userAgent: c.req.header("user-agent") ?? null,
    });
    return withSession(c, session);
  });

  router.post("/logout", async (c) => {
    const who = c.get("principal");
    if (who) await logout(c.get("deps"), who);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  router.get("/invitations/:token", async (c) => {
    const invitation = await findInvitation(
      c.get("deps").db,
      sha256Hex(c.req.param("token")),
      c.get("deps").now(),
    );
    if (!invitation) throw notFound("Invitation");
    return c.json({
      email: invitation.email,
      role: invitation.role,
      organization: invitation.organization_name,
      expires_at: new Date(invitation.expires_at).toISOString(),
    });
  });

  router.post("/invitations/accept", async (c) => {
    const body = await readJson(c, 8 * 1024);
    limit(c, undefined);
    const session = await acceptInvitation(c.get("deps"), {
      token: body.token,
      password: body.password,
      fullName: body.full_name,
      ip: c.get("clientIp"),
      userAgent: c.req.header("user-agent") ?? null,
    });
    return withSession(c, session);
  });

  router.get("/me", async (c) => {
    const who = principal(c);
    const { db } = c.get("deps");
    const [organizations, apps] = await Promise.all([
      listOrganizationsForUser(db, who.userId, who.isInstanceAdmin),
      listAccessibleApps(db, who.userId, who.isInstanceAdmin),
    ]);
    const restricted = keyAppRestriction(who);
    return c.json({
      user: {
        id: who.userId,
        email: who.email,
        full_name: who.fullName,
        role: who.isInstanceAdmin ? "instance_admin" : undefined,
      },
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: org.role ?? "owner",
      })),
      apps: apps
        .filter((app) => !restricted || app.id === restricted)
        .map((app) => serializeApp(app, app.role)),
      credential: {
        type: who.credential.type,
        app_id: restricted,
        ...(who.credential.type === "api_key" ? { role: who.credential.role } : {}),
      },
    });
  });

  router.put("/me", async (c) => {
    const who = principal(c);
    const body = await readJson(c, 8 * 1024);
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim().slice(0, 120) || null : null;
    const user = await updateProfile(c.get("deps").db, who.userId, { fullName });
    return c.json({ id: user.id, email: user.email, full_name: user.full_name });
  });

  router.post("/password", async (c) => {
    const who = principal(c);
    const body = await readJson(c, 8 * 1024);
    limit(c, who.email);
    await changePassword(c.get("deps"), who, {
      current: body.current_password,
      next: body.new_password,
    });
    return c.json({ ok: true });
  });

  return router;
}
