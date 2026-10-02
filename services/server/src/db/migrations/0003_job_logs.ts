import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    CREATE TABLE build_job_logs (
      job_id uuid PRIMARY KEY REFERENCES build_jobs (id) ON DELETE CASCADE,
      content text NOT NULL,
      truncated boolean NOT NULL DEFAULT false,
      fetched_at timestamptz NOT NULL DEFAULT now()
    );
  `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(db, `DROP TABLE IF EXISTS build_job_logs;`);
}
