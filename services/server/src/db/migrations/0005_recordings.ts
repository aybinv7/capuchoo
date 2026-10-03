import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    CREATE TABLE recording_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      session_key uuid NOT NULL,
      device_uuid uuid REFERENCES devices (id) ON DELETE SET NULL,
      device_id text NOT NULL,
      platform text NOT NULL,
      version_name text NOT NULL,
      version_code integer,
      channel text,
      start text NOT NULL,
      mode text NOT NULL,
      note text,
      device jsonb,
      recorder text,
      started_at timestamptz NOT NULL,
      ended_at timestamptz NOT NULL,
      segment_count integer NOT NULL DEFAULT 0,
      event_count bigint NOT NULL DEFAULT 0,
      size_bytes bigint NOT NULL DEFAULT 0,
      error_count integer NOT NULL DEFAULT 0,
      finished boolean NOT NULL DEFAULT false,
      last_segment_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (app_id, session_key)
    );
    CREATE INDEX recording_sessions_app_idx ON recording_sessions (app_id, started_at DESC);
    CREATE INDEX recording_sessions_device_idx ON recording_sessions (device_uuid, started_at DESC);
    CREATE INDEX recording_sessions_age_idx ON recording_sessions (last_segment_at);

    CREATE TABLE recording_segments (
      session_id uuid NOT NULL REFERENCES recording_sessions (id) ON DELETE CASCADE,
      seq integer NOT NULL,
      storage_key text NOT NULL,
      size_bytes integer NOT NULL,
      raw_bytes integer NOT NULL,
      events integer NOT NULL,
      errors integer NOT NULL,
      full_snapshot boolean NOT NULL,
      started_at timestamptz NOT NULL,
      ended_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (session_id, seq)
    );

    CREATE TABLE recording_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      scope text NOT NULL CHECK (scope IN ('app', 'channel', 'device')),
      channel_id uuid REFERENCES channels (id) ON DELETE CASCADE,
      device_uuid uuid REFERENCES devices (id) ON DELETE CASCADE,
      policy jsonb NOT NULL DEFAULT '{}'::jsonb,
      live_until timestamptz,
      updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (
        (scope = 'app' AND channel_id IS NULL AND device_uuid IS NULL)
        OR (scope = 'channel' AND channel_id IS NOT NULL AND device_uuid IS NULL)
        OR (scope = 'device' AND device_uuid IS NOT NULL AND channel_id IS NULL)
      )
    );
    CREATE UNIQUE INDEX recording_rules_app_idx ON recording_rules (app_id) WHERE scope = 'app';
    CREATE UNIQUE INDEX recording_rules_channel_idx ON recording_rules (channel_id) WHERE scope = 'channel';
    CREATE UNIQUE INDEX recording_rules_device_idx ON recording_rules (device_uuid) WHERE scope = 'device';

    CREATE TABLE recording_assets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      version_name text NOT NULL,
      path text NOT NULL,
      sha256 text NOT NULL,
      content_type text NOT NULL,
      storage_key text NOT NULL,
      size_bytes integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (app_id, version_name, path)
    );
  `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    DROP TABLE IF EXISTS recording_assets;
    DROP TABLE IF EXISTS recording_rules;
    DROP TABLE IF EXISTS recording_segments;
    DROP TABLE IF EXISTS recording_sessions;
  `,
  );
}
