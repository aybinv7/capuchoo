import type { Kysely } from "kysely";
import { Migrator, type MigrationResultSet } from "kysely/migration";
import { migrations } from "./migrations";

/** Applies pending migrations and throws, naming the one that failed, if any does. */
export async function migrateToLatest(db: Kysely<any>): Promise<MigrationResultSet> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
    migrationTableName: "capuchoo_migrations",
    migrationLockTableName: "capuchoo_migrations_lock",
  });
  const result = await migrator.migrateToLatest();
  if (result.error) {
    const failed = result.results?.find((entry) => entry.status === "Error")?.migrationName;
    const detail = result.error instanceof Error ? result.error.message : String(result.error);
    throw new Error(`Migration ${failed ?? "(unknown)"} failed: ${detail}`);
  }
  return result;
}
