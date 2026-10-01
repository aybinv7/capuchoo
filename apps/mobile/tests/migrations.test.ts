import { expect, test } from "vite-plus/test";
import { Kysely } from "kysely";
import { Migrator } from "kysely/migration";
import { createSqlJsDialect } from "@cavulsqa/mobile-db/testing";
import { migrations } from "../src/shared/database/migrations.js";
import type { Database } from "../src/shared/database/schema.js";

async function migrate(db: Kysely<Database>, set = migrations) {
  return new Migrator({ db, provider: { getMigrations: () => Promise.resolve(set) } }).migrateToLatest();
}

const TABLES = [
  "account",
  "organization",
  "app",
  "app_identifier",
  "channel",
  "native_build",
  "bundle",
  "installed",
  "activity",
];

test("a fresh database gets every table the schema declares", async () => {
  const db = new Kysely<Database>({ dialect: await createSqlJsDialect() });
  const result = await migrate(db);
  expect(result.error).toBeUndefined();

  const names = (await db.introspection.getTables()).map((table) => table.name);
  for (const table of TABLES) expect(names, table).toContain(table);
  await db.destroy();
});

test("running twice is a no-op", async () => {
  const db = new Kysely<Database>({ dialect: await createSqlJsDialect() });
  await migrate(db);
  const second = await migrate(db);
  expect(second.error).toBeUndefined();
  expect(second.results).toEqual([]);
  await db.destroy();
});

test("dropping an applied migration is refused, and the refusal is visible", async () => {
  const db = new Kysely<Database>({ dialect: await createSqlJsDialect() });
  await migrate(db);
  const result = await migrate(db, {});
  expect(result.error, "kysely must object to the missing migration").toBeDefined();
  await db.destroy();
});
