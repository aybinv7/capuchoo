import { loadConfig } from "./config";
import { createDatabase, createPostgresDialect } from "./db/database";
import { migrateToLatest } from "./db/migrator";
import { seedDemo } from "./demo";
import { findUserByEmail } from "./repositories/users";

/** Recreates the demo organization from a shell: `DEMO_EMAIL=you@example.com pnpm run seed:demo`. */
async function run(): Promise<void> {
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set DEMO_EMAIL to the account that will own the demo organization.");
  const config = loadConfig({
    ...process.env,
    SECRET_KEY: process.env.SECRET_KEY ?? "x".repeat(32),
  });
  if (config.NODE_ENV === "production" && config.DEMO_SEED !== "enabled") {
    throw new Error("Refusing to seed demo data in production unless DEMO_SEED=enabled.");
  }
  const db = createDatabase(createPostgresDialect(config));
  try {
    await migrateToLatest(db);
    const owner = await findUserByEmail(db, email);
    if (!owner) throw new Error(`No account for ${email}; sign up or create it first.`);
    const summary = await seedDemo(db, { ownerId: owner.id });
    for (const app of summary.apps) {
      process.stdout.write(
        `${app.name}: ${app.devices} devices, ${app.events} device events, ${app.runs} CI runs\n`,
      );
    }
  } finally {
    await db.destroy();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
