import type { Db } from "../db/database";
import { hashPassword } from "../lib/crypto";
import { revokeUserSessions } from "../repositories/sessions";
import { createUser, findUserByEmail, normalizeEmail } from "../repositories/users";
import { validatePassword } from "./auth-service";

export type AdminAccountResult = "created" | "reset";

/**
 * Makes `email` an instance admin with `password`, for the first sign-in on a database that is no
 * longer empty or for an operator locked out of their own server. An existing account keeps its
 * memberships; its password is replaced and every session it had is revoked.
 */
export async function ensureInstanceAdmin(
  db: Db,
  input: { email: string; password: string; fullName?: string },
): Promise<AdminAccountResult> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ADMIN_EMAIL is not an email");
  const passwordHash = await hashPassword(validatePassword(input.password));

  return db.transaction().execute(async (trx) => {
    const existing = await findUserByEmail(trx, email);
    if (!existing) {
      await createUser(trx, {
        email,
        passwordHash,
        fullName: input.fullName ?? "Administrator",
        isInstanceAdmin: true,
      });
      return "created";
    }
    await trx
      .updateTable("users")
      .set({ password_hash: passwordHash, is_instance_admin: true, updated_at: new Date() })
      .where("id", "=", existing.id)
      .execute();
    await revokeUserSessions(trx, existing.id);
    return "reset";
  });
}
