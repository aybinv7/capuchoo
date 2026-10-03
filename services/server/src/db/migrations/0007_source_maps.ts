import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    CREATE TABLE source_maps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      version_name text NOT NULL,
      path text NOT NULL,
      storage_key text NOT NULL,
      size_bytes bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (app_id, version_name, path)
    );
    CREATE INDEX source_maps_age_idx ON source_maps (created_at);
    `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(db, `DROP TABLE IF EXISTS source_maps;`);
}
