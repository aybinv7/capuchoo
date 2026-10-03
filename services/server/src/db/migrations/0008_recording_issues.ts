import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    CREATE TABLE recording_issues (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      fingerprint text NOT NULL,
      message text NOT NULL,
      frame text,
      status text NOT NULL DEFAULT 'open',
      occurrences bigint NOT NULL DEFAULT 0,
      first_version text NOT NULL,
      last_version text NOT NULL,
      first_seen timestamptz NOT NULL,
      last_seen timestamptz NOT NULL,
      resolved_at timestamptz,
      UNIQUE (app_id, fingerprint)
    );
    CREATE INDEX recording_issues_app_idx ON recording_issues (app_id, last_seen DESC);

    CREATE TABLE recording_issue_sessions (
      issue_id uuid NOT NULL REFERENCES recording_issues (id) ON DELETE CASCADE,
      session_id uuid NOT NULL REFERENCES recording_sessions (id) ON DELETE CASCADE,
      device_id text NOT NULL,
      version_name text NOT NULL,
      first_at timestamptz NOT NULL,
      occurrences integer NOT NULL DEFAULT 0,
      PRIMARY KEY (issue_id, session_id)
    );
    CREATE INDEX recording_issue_sessions_session_idx ON recording_issue_sessions (session_id);
    `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    DROP TABLE IF EXISTS recording_issue_sessions;
    DROP TABLE IF EXISTS recording_issues;
    `,
  );
}
