import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { Db } from "../src/db/database";
import { verifyPassword } from "../src/lib/crypto";
import { createSession, findSession } from "../src/repositories/sessions";
import { createUser, findUserByEmail } from "../src/repositories/users";
import { ensureInstanceAdmin } from "../src/services/admin-account";
import { createTestDatabase } from "./database";

const PASSWORD = "correct horse battery";

describe("ensureInstanceAdmin", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await db.destroy();
  });

  it("creates an instance admin when the email is unknown", async () => {
    expect(await ensureInstanceAdmin(db, { email: " Ops@Example.com ", password: PASSWORD })).toBe(
      "created",
    );
    const user = await findUserByEmail(db, "ops@example.com");
    expect(user?.is_instance_admin).toBe(true);
    expect(await verifyPassword(PASSWORD, user?.password_hash ?? null)).toBe(true);
  });

  it("promotes and resets an existing account and signs it out everywhere", async () => {
    const user = await createUser(db, { email: "dev@example.com", passwordHash: null });
    await createSession(db, {
      userId: user.id,
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 86_400_000),
      ip: null,
      userAgent: null,
    });

    expect(await ensureInstanceAdmin(db, { email: "dev@example.com", password: PASSWORD })).toBe(
      "reset",
    );
    const updated = await findUserByEmail(db, "dev@example.com");
    expect(updated?.is_instance_admin).toBe(true);
    expect(await verifyPassword(PASSWORD, updated?.password_hash ?? null)).toBe(true);
    expect(await findSession(db, "hash", new Date())).toBeUndefined();
  });

  it("refuses a weak password and a malformed email without writing", async () => {
    await expect(ensureInstanceAdmin(db, { email: "a@b.co", password: "short" })).rejects.toThrow();
    await expect(
      ensureInstanceAdmin(db, { email: "not-an-email", password: PASSWORD }),
    ).rejects.toThrow("not an email");
    expect(await findUserByEmail(db, "a@b.co")).toBeUndefined();
  });
});
