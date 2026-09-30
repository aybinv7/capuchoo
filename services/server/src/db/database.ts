import { Kysely, PostgresDialect, type Dialect } from "kysely";
import pg from "pg";
import type { Config } from "../config";
import type { Database } from "./schema";

pg.types.setTypeParser(pg.types.builtins.INT8, (value) => value);

export type Db = Kysely<Database>;

/** A pooled PostgreSQL connection; statements time out rather than hold a connection forever. */
export function createPostgresDialect(config: Config): Dialect {
  const wantsSsl = config.DATABASE_SSL ?? /sslmode=require/.test(config.DATABASE_URL);
  return new PostgresDialect({
    pool: new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      application_name: "capuchoo-server",
      ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    }),
  });
}

export function createDatabase(dialect: Dialect): Db {
  return new Kysely<Database>({ dialect });
}
