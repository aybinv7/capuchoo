import { loadConfig } from "./config";
import { createDatabase, createPostgresDialect } from "./db/database";
import { migrateToLatest } from "./db/migrator";

/** Applies pending migrations and exits; for deploy pipelines that migrate before starting. */
async function run(): Promise<void> {
  const db = createDatabase(
    createPostgresDialect(
      loadConfig({ ...process.env, SECRET_KEY: process.env.SECRET_KEY ?? "x".repeat(32) }),
    ),
  );
  try {
    const result = await migrateToLatest(db);
    for (const entry of result.results ?? [])
      process.stdout.write(`${entry.status}  ${entry.migrationName}\n`);
    if (!result.results?.length) process.stdout.write("Up to date\n");
  } finally {
    await db.destroy();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
