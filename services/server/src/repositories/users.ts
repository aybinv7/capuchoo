import type { Db } from "../db/database";
import type { User } from "../db/schema";

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export function findUserByEmail(db: Db, email: string): Promise<User | undefined> {
  return db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", normalizeEmail(email))
    .executeTakeFirst();
}

export function findUserById(db: Db, id: string): Promise<User | undefined> {
  return db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function createUser(
  db: Db,
  input: {
    email: string;
    passwordHash: string | null;
    fullName?: string | null;
    isInstanceAdmin?: boolean;
  },
): Promise<User> {
  return db
    .insertInto("users")
    .values({
      email: normalizeEmail(input.email),
      password_hash: input.passwordHash,
      full_name: input.fullName ?? null,
      is_instance_admin: input.isInstanceAdmin ?? false,
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function countUsers(db: Db): Promise<number> {
  const row = await db
    .selectFrom("users")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function setPassword(db: Db, userId: string, passwordHash: string): Promise<void> {
  await db
    .updateTable("users")
    .set({ password_hash: passwordHash, updated_at: new Date() })
    .where("id", "=", userId)
    .execute();
}

export async function updateProfile(
  db: Db,
  userId: string,
  input: { fullName: string | null },
): Promise<User> {
  return db
    .updateTable("users")
    .set({ full_name: input.fullName, updated_at: new Date() })
    .where("id", "=", userId)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function touchLogin(db: Db, userId: string): Promise<void> {
  await db
    .updateTable("users")
    .set({ last_login_at: new Date() })
    .where("id", "=", userId)
    .execute();
}
