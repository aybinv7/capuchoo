import type { AppRole } from "@capuchoo/core";
import type { Db } from "../db/database";

export interface ApiKeyPrincipalRow {
  keyId: string;
  appId: string | null;
  role: AppRole | null;
  userId: string;
  email: string;
  fullName: string | null;
  isInstanceAdmin: boolean;
  lastUsedAt: Date | null;
}

export async function findApiKey(
  db: Db,
  keyHash: string,
  now: Date,
): Promise<ApiKeyPrincipalRow | undefined> {
  return db
    .selectFrom("api_keys")
    .innerJoin("users", "users.id", "api_keys.user_id")
    .select([
      "api_keys.id as keyId",
      "api_keys.app_id as appId",
      "api_keys.role",
      "users.id as userId",
      "users.email",
      "users.full_name as fullName",
      "users.is_instance_admin as isInstanceAdmin",
      "api_keys.last_used_at as lastUsedAt",
    ])
    .where("api_keys.key_hash", "=", keyHash)
    .where("api_keys.revoked_at", "is", null)
    .where((eb) =>
      eb.or([eb("api_keys.expires_at", "is", null), eb("api_keys.expires_at", ">", now)]),
    )
    .where("users.disabled_at", "is", null)
    .executeTakeFirst();
}

export async function touchApiKey(db: Db, keyId: string, now: Date): Promise<void> {
  await db.updateTable("api_keys").set({ last_used_at: now }).where("id", "=", keyId).execute();
}

export async function createApiKey(
  db: Db,
  input: {
    userId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    appId: string | null;
    role: AppRole | null;
    expiresAt: Date | null;
  },
) {
  return db
    .insertInto("api_keys")
    .values({
      user_id: input.userId,
      name: input.name,
      key_hash: input.keyHash,
      key_prefix: input.keyPrefix,
      app_id: input.appId,
      role: input.role,
      expires_at: input.expiresAt,
    })
    .returning(["id", "name", "key_prefix", "app_id", "role", "created_at", "expires_at"])
    .executeTakeFirstOrThrow();
}

export function listApiKeys(db: Db, userId: string) {
  return db
    .selectFrom("api_keys")
    .select([
      "id",
      "name",
      "key_prefix",
      "app_id",
      "role",
      "created_at",
      "last_used_at",
      "expires_at",
    ])
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .orderBy("created_at", "desc")
    .execute();
}

/** Revokes a key the user owns; false when there was none. */
export async function revokeApiKey(
  db: Db,
  userId: string,
  keyId: string,
  now: Date,
): Promise<boolean> {
  const result = await db
    .updateTable("api_keys")
    .set({ revoked_at: now })
    .where("id", "=", keyId)
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}
