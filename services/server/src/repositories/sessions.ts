import type { Db } from "../db/database";

export interface SessionRow {
  sessionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  isInstanceAdmin: boolean;
  lastSeenAt: Date;
  expiresAt: Date;
}

export async function createSession(
  db: Db,
  input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<string> {
  const row = await db
    .insertInto("sessions")
    .values({
      user_id: input.userId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      ip: input.ip,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      last_seen_at: new Date(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

/** A live session for an enabled user, or undefined. */
export async function findSession(
  db: Db,
  tokenHash: string,
  now: Date,
): Promise<SessionRow | undefined> {
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .select([
      "sessions.id as sessionId",
      "users.id as userId",
      "users.email",
      "users.full_name as fullName",
      "users.is_instance_admin as isInstanceAdmin",
      "sessions.last_seen_at as lastSeenAt",
      "sessions.expires_at as expiresAt",
    ])
    .where("sessions.token_hash", "=", tokenHash)
    .where("sessions.expires_at", ">", now)
    .where("users.disabled_at", "is", null)
    .executeTakeFirst();
  return row;
}

export async function extendSession(
  db: Db,
  sessionId: string,
  now: Date,
  expiresAt: Date,
): Promise<void> {
  await db
    .updateTable("sessions")
    .set({ last_seen_at: now, expires_at: expiresAt })
    .where("id", "=", sessionId)
    .execute();
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.deleteFrom("sessions").where("id", "=", sessionId).execute();
}

export async function revokeUserSessions(
  db: Db,
  userId: string,
  exceptSessionId?: string,
): Promise<void> {
  let query = db.deleteFrom("sessions").where("user_id", "=", userId);
  if (exceptSessionId) query = query.where("id", "<>", exceptSessionId);
  await query.execute();
}

export async function purgeExpiredSessions(db: Db, now: Date): Promise<number> {
  const result = await db.deleteFrom("sessions").where("expires_at", "<=", now).executeTakeFirst();
  return Number(result.numDeletedRows);
}
