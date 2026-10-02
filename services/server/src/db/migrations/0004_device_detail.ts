import { classifyUpdateEvent } from "@capuchoo/core";
import { sql, type Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    ALTER TABLE devices ADD COLUMN attributes jsonb;
    ALTER TABLE devices ADD COLUMN attributes_updated_at timestamptz;
    ALTER TABLE device_events ADD COLUMN category text;
    CREATE INDEX device_events_device_idx ON device_events (device_uuid, id DESC);
    CREATE INDEX device_events_category_idx ON device_events (app_id, category, id DESC);
  `,
  );
  const actions = await sql<{ action: string }>`SELECT DISTINCT action FROM device_events`.execute(
    db,
  );
  for (const { action } of actions.rows) {
    await sql`UPDATE device_events SET category = ${classifyUpdateEvent(action)} WHERE action = ${action}`.execute(
      db,
    );
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    DROP INDEX IF EXISTS device_events_category_idx, device_events_device_idx;
    ALTER TABLE device_events DROP COLUMN IF EXISTS category;
    ALTER TABLE devices DROP COLUMN IF EXISTS attributes_updated_at, DROP COLUMN IF EXISTS attributes;
  `,
  );
}
