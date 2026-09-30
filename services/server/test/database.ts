import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely-pglite-dialect";
import { createDatabase, type Db } from "../src/db/database";
import { migrateToLatest } from "../src/db/migrator";

/** A fresh, fully migrated in-memory PostgreSQL per call. */
export async function createTestDatabase(): Promise<Db> {
  const db = createDatabase(new PGliteDialect(new PGlite()));
  await migrateToLatest(db);
  return db;
}
