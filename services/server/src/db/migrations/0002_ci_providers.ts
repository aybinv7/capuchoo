import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    ALTER TABLE integrations DROP CONSTRAINT integrations_kind_check;
    ALTER TABLE integrations ADD CONSTRAINT integrations_kind_check CHECK (kind IN ('gitlab', 'github'));
    ALTER TABLE integrations ALTER COLUMN secret_hash DROP NOT NULL;
    ALTER TABLE integrations ADD CONSTRAINT integrations_gitlab_secret CHECK (kind <> 'gitlab' OR secret_hash IS NOT NULL);
    ALTER TABLE integrations ADD COLUMN external_ref text;
    ALTER TABLE integrations ADD COLUMN credential_enc text;
    ALTER TABLE integrations ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    CREATE INDEX integrations_external_idx ON integrations (kind, external_ref) WHERE external_ref IS NOT NULL;

    CREATE TABLE github_app (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      app_id bigint NOT NULL,
      slug text NOT NULL,
      name text NOT NULL,
      client_id text NOT NULL,
      client_secret_enc text NOT NULL,
      private_key_enc text NOT NULL,
      webhook_secret_enc text NOT NULL,
      html_url text NOT NULL,
      owner_login text,
      created_by uuid REFERENCES users (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE github_installations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      installation_id bigint NOT NULL,
      account_login text NOT NULL,
      account_type text NOT NULL CHECK (account_type IN ('User', 'Organization')),
      repository_selection text CHECK (repository_selection IN ('all', 'selected')),
      suspended_at timestamptz,
      created_by uuid REFERENCES users (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, installation_id)
    );
    CREATE INDEX github_installations_installation_idx ON github_installations (installation_id);

    ALTER TABLE builds ADD COLUMN parent_id uuid REFERENCES builds (id) ON DELETE CASCADE;
    ALTER TABLE builds ADD COLUMN job_key text CHECK (length(job_key) <= 255);
    ALTER TABLE builds ADD COLUMN run_attempt integer CHECK (run_attempt > 0);
    ALTER TABLE builds ADD COLUMN plan jsonb;
    ALTER TABLE builds ADD COLUMN workflow text CHECK (length(workflow) <= 255);
    ALTER TABLE builds ADD COLUMN title text CHECK (length(title) <= 255);
    ALTER TABLE builds ADD COLUMN trigger text CHECK (length(trigger) <= 64);
    ALTER TABLE builds ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    CREATE INDEX builds_parent_idx ON builds (parent_id) WHERE parent_id IS NOT NULL;
    CREATE INDEX builds_open_pipeline_idx ON builds (created_at)
      WHERE kind = 'pipeline' AND status IN ('queued', 'running');

    CREATE TABLE build_jobs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      build_id uuid NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
      external_id text NOT NULL CHECK (length(external_id) <= 64),
      plan_key text CHECK (length(plan_key) <= 255),
      name text NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
      stage text CHECK (length(stage) <= 255),
      status text NOT NULL CHECK (status IN ('pending', 'queued', 'waiting', 'running', 'succeeded', 'failed', 'cancelled', 'skipped')),
      attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
      url text CHECK (length(url) <= 2000),
      runner text CHECK (length(runner) <= 255),
      steps jsonb NOT NULL DEFAULT '[]',
      started_at timestamptz,
      finished_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (build_id, external_id)
    );
  `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    DROP TABLE IF EXISTS build_jobs, github_installations, github_app;
    DROP INDEX IF EXISTS builds_open_pipeline_idx, builds_parent_idx, integrations_external_idx;
    ALTER TABLE builds DROP COLUMN IF EXISTS parent_id, DROP COLUMN IF EXISTS job_key,
      DROP COLUMN IF EXISTS run_attempt, DROP COLUMN IF EXISTS plan, DROP COLUMN IF EXISTS workflow,
      DROP COLUMN IF EXISTS title, DROP COLUMN IF EXISTS trigger, DROP COLUMN IF EXISTS updated_at;
    DELETE FROM integrations WHERE kind <> 'gitlab';
    ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_gitlab_secret;
    ALTER TABLE integrations DROP CONSTRAINT integrations_kind_check;
    ALTER TABLE integrations ADD CONSTRAINT integrations_kind_check CHECK (kind IN ('gitlab'));
    ALTER TABLE integrations ALTER COLUMN secret_hash SET NOT NULL;
    ALTER TABLE integrations DROP COLUMN IF EXISTS external_ref, DROP COLUMN IF EXISTS credential_enc,
      DROP COLUMN IF EXISTS updated_at;
  `,
  );
}
