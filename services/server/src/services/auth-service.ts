import type { Principal } from "../auth/principal";
import { SESSION_PREFIX } from "../auth/tokens";
import type { Deps } from "../http/context";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "../lib/crypto";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { writeAudit } from "../repositories/audit";
import {
  findInvitation,
  markInvitationAccepted,
  upsertMember,
} from "../repositories/organizations";
import { createSession, revokeSession, revokeUserSessions } from "../repositories/sessions";
import {
  countUsers,
  createUser,
  findUserByEmail,
  findUserById,
  normalizeEmail,
  setPassword,
  touchLogin,
} from "../repositories/users";

export const MIN_PASSWORD = 12;

/** Rejects passwords too short or too common to protect a release pipeline. */
export function validatePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw badRequest(`The password must be at least ${MIN_PASSWORD} characters`, "weak_password");
  }
  if (password.length > 256) throw badRequest("The password is too long", "weak_password");
  if (/^(.)\1+$/.test(password) || /^(?:0123456789|password|qwerty)/i.test(password)) {
    throw badRequest("That password is too easy to guess", "weak_password");
  }
  return password;
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  user: { id: string; email: string; full_name: string | null };
}

async function issueSession(
  deps: Deps,
  user: { id: string; email: string; full_name: string | null },
  meta: { ip: string | null; userAgent: string | null },
): Promise<IssuedSession> {
  const token = randomToken(SESSION_PREFIX);
  const expiresAt = new Date(deps.now().getTime() + deps.config.SESSION_TTL_DAYS * 86_400_000);
  await createSession(deps.db, {
    userId: user.id,
    tokenHash: sha256Hex(token),
    expiresAt,
    ...meta,
  });
  await touchLogin(deps.db, user.id);
  return { token, expiresAt, user: { id: user.id, email: user.email, full_name: user.full_name } };
}

/** Email + password to a session. The same error for an unknown email and a wrong password. */
export async function login(
  deps: Deps,
  input: { email: unknown; password: unknown; ip: string | null; userAgent: string | null },
): Promise<IssuedSession> {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    throw badRequest("Email and password are required");
  }
  const user = await findUserByEmail(deps.db, input.email);
  const valid = await verifyPassword(input.password, user?.password_hash ?? null);
  if (!user || !valid || user.disabled_at) throw unauthorized("Invalid email or password");
  return issueSession(deps, user, { ip: input.ip, userAgent: input.userAgent });
}

export async function logout(deps: Deps, principal: Principal): Promise<void> {
  if (principal.credential.type === "session")
    await revokeSession(deps.db, principal.credential.sessionId);
}

/** Creates the first instance admin on an empty database; a no-op afterwards. */
export async function bootstrapAdmin(deps: Deps): Promise<boolean> {
  const { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password } = deps.config;
  if (!email || !password) return false;
  if ((await countUsers(deps.db)) > 0) return false;
  await createUser(deps.db, {
    email,
    passwordHash: await hashPassword(validatePassword(password)),
    fullName: "Administrator",
    isInstanceAdmin: true,
  });
  deps.logger.info("bootstrap admin created", { email: normalizeEmail(email) });
  return true;
}

/** Open registration, only when SIGNUP=open. */
export async function register(
  deps: Deps,
  input: {
    email: unknown;
    password: unknown;
    fullName: unknown;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<IssuedSession> {
  if (deps.config.SIGNUP !== "open")
    throw forbidden(
      "Sign-up is closed on this server. Ask an administrator for an invitation.",
      "signup_closed",
    );
  if (typeof input.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email))
    throw badRequest("A valid email is required");
  if (await findUserByEmail(deps.db, input.email))
    throw conflict("An account with this email already exists", "email_taken");
  const user = await createUser(deps.db, {
    email: input.email,
    passwordHash: await hashPassword(validatePassword(input.password)),
    fullName:
      typeof input.fullName === "string" ? input.fullName.trim().slice(0, 120) || null : null,
  });
  return issueSession(deps, user, { ip: input.ip, userAgent: input.userAgent });
}

/** Accepts an invitation: creates or activates the account, joins the organization, signs in. */
export async function acceptInvitation(
  deps: Deps,
  input: {
    token: unknown;
    password: unknown;
    fullName: unknown;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<IssuedSession> {
  if (typeof input.token !== "string") throw badRequest("token is required");
  const invitation = await findInvitation(deps.db, sha256Hex(input.token), deps.now());
  if (!invitation) throw notFound("Invitation");

  const existing = await findUserByEmail(deps.db, invitation.email);
  let user = existing;
  if (!user) {
    user = await createUser(deps.db, {
      email: invitation.email,
      passwordHash: await hashPassword(validatePassword(input.password)),
      fullName:
        typeof input.fullName === "string" ? input.fullName.trim().slice(0, 120) || null : null,
    });
  } else if (!user.password_hash) {
    await setPassword(deps.db, user.id, await hashPassword(validatePassword(input.password)));
  } else if (!(await verifyPassword(String(input.password ?? ""), user.password_hash))) {
    throw unauthorized("This email already has an account; enter its password to accept.");
  }

  await upsertMember(deps.db, invitation.organization_id, user.id, invitation.role);
  await markInvitationAccepted(deps.db, invitation.id, deps.now());
  await writeAudit(deps.db, {
    organizationId: invitation.organization_id,
    actorUserId: user.id,
    actorApiKeyId: null,
    action: "invitation.accept",
    targetType: "user",
    targetId: user.id,
    details: { role: invitation.role },
    ip: input.ip,
  });
  return issueSession(deps, user, { ip: input.ip, userAgent: input.userAgent });
}

/** Changes the caller's password after checking the current one; other sessions are signed out. */
export async function changePassword(
  deps: Deps,
  principal: Principal,
  input: { current: unknown; next: unknown },
): Promise<void> {
  const user = await findUserById(deps.db, principal.userId);
  if (!user) throw unauthorized();
  if (!(await verifyPassword(String(input.current ?? ""), user.password_hash))) {
    throw forbidden("The current password is wrong", "wrong_password");
  }
  await setPassword(deps.db, user.id, await hashPassword(validatePassword(input.next)));
  await revokeUserSessions(
    deps.db,
    user.id,
    principal.credential.type === "session" ? principal.credential.sessionId : undefined,
  );
}
