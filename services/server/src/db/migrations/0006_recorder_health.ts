import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    CREATE TABLE recorder_health (
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      device_id text NOT NULL,
      device_uuid uuid REFERENCES devices (id) ON DELETE SET NULL,
      platform text NOT NULL,
      version_name text NOT NULL,
      channel text,
      health jsonb NOT NULL,
      seen_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (app_id, device_id)
    );
    CREATE INDEX recorder_health_seen_idx ON recorder_health (app_id, seen_at DESC);
    `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(db, `DROP TABLE IF EXISTS recorder_health;`);
}
