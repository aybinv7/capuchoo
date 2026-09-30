import { loadConfig } from "./config";
import { createDatabase, createPostgresDialect } from "./db/database";
import { migrateToLatest } from "./db/migrator";
import { ensureInstanceAdmin } from "./services/admin-account";

/**
 * Creates or resets an instance admin from ADMIN_EMAIL and ADMIN_PASSWORD. Both come from the
 * environment, never from arguments, so the password stays out of shell history and process lists.
 */
async function run(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment");

  const db = createDatabase(
    createPostgresDialect(
      loadConfig({ ...process.env, SECRET_KEY: process.env.SECRET_KEY ?? "x".repeat(32) }),
    ),
  );
  try {
    await migrateToLatest(db);
    const result = await ensureInstanceAdmin(db, { email, password });
    process.stdout.write(
      result === "created"
        ? `Created instance admin ${email.trim().toLowerCase()}\n`
        : `Reset the password of ${email.trim().toLowerCase()}, made it an instance admin and signed it out everywhere\n`,
    );
  } finally {
    await db.destroy();
  }
}

run().catch((error: unknown) => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "Failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
