import type { Kysely } from "kysely";
import { executeStatements } from "../sql-script";

export async function up(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL CHECK (email = lower(email) AND position('@' in email) > 1),
      password_hash text,
      full_name text,
      is_instance_admin boolean NOT NULL DEFAULT false,
      disabled_at timestamptz,
      last_login_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX users_email_key ON users (email);

    CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      ip text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX sessions_user_idx ON sessions (user_id);
    CREATE INDEX sessions_expires_idx ON sessions (expires_at);

    CREATE TABLE organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE organization_members (
      organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, user_id)
    );
    CREATE INDEX organization_members_user_idx ON organization_members (user_id);

    CREATE TABLE invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      email text NOT NULL CHECK (email = lower(email)),
      role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
      token_hash text NOT NULL UNIQUE,
      invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      accepted_at timestamptz
    );
    CREATE INDEX invitations_org_idx ON invitations (organization_id);

    CREATE TABLE apps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
      app_id text NOT NULL UNIQUE CHECK (length(app_id) BETWEEN 3 AND 255),
      name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      platform text NOT NULL DEFAULT 'all',
      icon_url text,
      public_key text,
      require_signature boolean NOT NULL DEFAULT false,
      prod_role text NOT NULL DEFAULT 'admin' CHECK (prod_role IN ('admin', 'developer')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (NOT require_signature OR public_key IS NOT NULL)
    );
    CREATE INDEX apps_org_idx ON apps (organization_id);

    CREATE TABLE app_identifiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      bundle_id text NOT NULL UNIQUE,
      platform text NOT NULL DEFAULT 'all' CHECK (platform IN ('android', 'ios', 'all')),
      flavour text CHECK (flavour IN ('prod', 'staging', 'dev')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX app_identifiers_app_idx ON app_identifiers (app_id);

    CREATE TABLE app_permissions (
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('admin', 'developer', 'tester', 'viewer')),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (app_id, user_id)
    );
    CREATE INDEX app_permissions_user_idx ON app_permissions (user_id);

    CREATE TABLE api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
      key_hash text NOT NULL UNIQUE,
      key_prefix text NOT NULL,
      app_id uuid REFERENCES apps (id) ON DELETE CASCADE,
      role text CHECK (role IN ('admin', 'developer', 'tester', 'viewer')),
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      expires_at timestamptz,
      revoked_at timestamptz
    );
    CREATE INDEX api_keys_user_idx ON api_keys (user_id);

    CREATE TABLE bundles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
      version_name text NOT NULL CHECK (length(version_name) BETWEEN 1 AND 64),
      flavour text NOT NULL CHECK (flavour IN ('prod', 'staging', 'dev')),
      storage_key text NOT NULL,
      size_bytes bigint NOT NULL CHECK (size_bytes > 0),
      checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      signature text,
      min_native_version integer CHECK (min_native_version IS NULL OR min_native_version > 0),
      required boolean NOT NULL DEFAULT false,
      release_notes text,
      uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
      api_key_id uuid REFERENCES api_keys (id) ON DELETE SET NULL,
      build_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE UNIQUE INDEX bundles_version_key ON bundles (app_id, platform, version_name);
    CREATE INDEX bundles_app_created_idx ON bundles (app_id, created_at DESC);

    CREATE TABLE native_builds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      platform text NOT NULL CHECK (platform IN ('android', 'ios')),
      version_name text NOT NULL CHECK (length(version_name) BETWEEN 1 AND 64),
      version_code integer NOT NULL CHECK (version_code > 0),
      flavour text NOT NULL CHECK (flavour IN ('prod', 'staging', 'dev')),
      storage_key text NOT NULL,
      size_bytes bigint NOT NULL CHECK (size_bytes > 0),
      checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      signature text,
      signing_cert_sha256 text CHECK (signing_cert_sha256 IS NULL OR signing_cert_sha256 ~ '^[0-9a-f]{64}$'),
      required boolean NOT NULL DEFAULT false,
      release_notes text,
      min_sdk integer,
      uploaded_by uuid REFERENCES users (id) ON DELETE SET NULL,
      api_key_id uuid REFERENCES api_keys (id) ON DELETE SET NULL,
      build_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE UNIQUE INDEX native_builds_code_key ON native_builds (app_id, platform, flavour, version_code);
    CREATE INDEX native_builds_app_created_idx ON native_builds (app_id, created_at DESC);

    CREATE TABLE channels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      name text NOT NULL CHECK (name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
      environment text NOT NULL CHECK (environment IN ('prod', 'staging', 'dev')),
      kind text NOT NULL DEFAULT 'release' CHECK (kind IN ('release', 'client')),
      base_channel_id uuid REFERENCES channels (id) ON DELETE RESTRICT,
      allow_dev boolean NOT NULL DEFAULT true,
      allow_emulator boolean NOT NULL DEFAULT true,
      ios_enabled boolean NOT NULL DEFAULT true,
      android_enabled boolean NOT NULL DEFAULT true,
      allow_device_self_set boolean NOT NULL DEFAULT false,
      is_public boolean NOT NULL DEFAULT false,
      paused boolean NOT NULL DEFAULT false,
      allow_downgrade boolean NOT NULL DEFAULT false,
      current_bundle_id uuid REFERENCES bundles (id) ON DELETE RESTRICT,
      current_native_id uuid REFERENCES native_builds (id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (app_id, name),
      CHECK ((kind = 'client') = (base_channel_id IS NOT NULL)),
      CHECK (base_channel_id IS NULL OR base_channel_id <> id)
    );
    CREATE INDEX channels_base_idx ON channels (base_channel_id);

    CREATE TABLE channel_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      channel_id uuid NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      action text NOT NULL,
      from_id uuid,
      to_id uuid,
      from_version text,
      to_version text,
      actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
      actor_api_key_id uuid REFERENCES api_keys (id) ON DELETE SET NULL,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX channel_events_channel_idx ON channel_events (channel_id, created_at DESC);
    CREATE INDEX channel_events_to_idx ON channel_events (channel_id, to_id);

    CREATE TABLE devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      device_id text NOT NULL CHECK (length(device_id) BETWEEN 1 AND 255),
      custom_id text,
      platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
      is_prod boolean,
      is_emulator boolean,
      version_name text,
      version_builtin text,
      version_code integer,
      version_os text,
      plugin_version text,
      reported_channel text,
      channel_id uuid REFERENCES channels (id) ON DELETE SET NULL,
      assigned_channel_id uuid REFERENCES channels (id) ON DELETE SET NULL,
      self_channel_id uuid REFERENCES channels (id) ON DELETE SET NULL,
      device_name text,
      manufacturer text,
      model text,
      mem_used_bytes bigint,
      latitude double precision CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
      longitude double precision CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
      location_accuracy_m double precision,
      location_reported_at timestamptz,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (app_id, device_id)
    );
    CREATE INDEX devices_app_seen_idx ON devices (app_id, last_seen_at DESC);
    CREATE INDEX devices_channel_idx ON devices (channel_id);

    CREATE TABLE device_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      device_uuid uuid REFERENCES devices (id) ON DELETE SET NULL,
      channel_id uuid REFERENCES channels (id) ON DELETE SET NULL,
      kind text NOT NULL CHECK (kind IN ('ota', 'native', 'check')),
      action text NOT NULL CHECK (length(action) <= 64),
      status text,
      version_from text,
      version_to text,
      version_code_to integer,
      error text,
      details jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX device_events_app_idx ON device_events (app_id, created_at DESC);
    CREATE INDEX device_events_channel_idx ON device_events (channel_id, created_at DESC);
    CREATE INDEX device_events_created_idx ON device_events (created_at);

    CREATE TABLE builds (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      channel_id uuid REFERENCES channels (id) ON DELETE SET NULL,
      channel_name text,
      kind text NOT NULL CHECK (kind IN ('ota', 'native', 'pipeline')),
      status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
      version_name text,
      version_code integer,
      flavour text CHECK (flavour IN ('prod', 'staging', 'dev')),
      source text NOT NULL CHECK (source IN ('cli', 'gitlab', 'github', 'other')),
      external_id text,
      commit_sha text,
      ref text,
      pipeline_url text,
      job_url text,
      actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
      actor_api_key_id uuid REFERENCES api_keys (id) ON DELETE SET NULL,
      bundle_id uuid REFERENCES bundles (id) ON DELETE SET NULL,
      native_id uuid REFERENCES native_builds (id) ON DELETE SET NULL,
      error text,
      started_at timestamptz,
      finished_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX builds_app_idx ON builds (app_id, created_at DESC);
    CREATE UNIQUE INDEX builds_external_key ON builds (app_id, source, external_id) WHERE external_id IS NOT NULL;

    CREATE TABLE build_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      build_id uuid NOT NULL REFERENCES builds (id) ON DELETE CASCADE,
      step text NOT NULL CHECK (length(step) BETWEEN 1 AND 64),
      status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'skipped', 'info')),
      message text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX build_events_build_idx ON build_events (build_id, id);

    CREATE TABLE audit_log (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      organization_id uuid REFERENCES organizations (id) ON DELETE CASCADE,
      app_id uuid REFERENCES apps (id) ON DELETE CASCADE,
      actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
      actor_api_key_id uuid REFERENCES api_keys (id) ON DELETE SET NULL,
      action text NOT NULL,
      target_type text NOT NULL,
      target_id text,
      details jsonb,
      ip text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_log_app_idx ON audit_log (app_id, created_at DESC);
    CREATE INDEX audit_log_org_idx ON audit_log (organization_id, created_at DESC);

    CREATE TABLE app_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      environment text NOT NULL DEFAULT 'all' CHECK (environment IN ('all', 'prod', 'staging', 'dev')),
      channel text,
      key text NOT NULL CHECK (key ~ '^[A-Za-z_][A-Za-z0-9_.-]{0,127}$'),
      value text NOT NULL,
      value_type text NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX app_config_key ON app_config (app_id, environment, coalesce(channel, ''), key);

    CREATE TABLE integrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      app_id uuid NOT NULL REFERENCES apps (id) ON DELETE CASCADE,
      kind text NOT NULL CHECK (kind IN ('gitlab')),
      secret_hash text NOT NULL,
      config jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_event_at timestamptz,
      UNIQUE (app_id, kind)
    );

    CREATE TABLE blobs (
      key text PRIMARY KEY,
      size_bytes bigint NOT NULL,
      content_type text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE blob_chunks (
      key text NOT NULL REFERENCES blobs (key) ON DELETE CASCADE,
      idx integer NOT NULL,
      data bytea NOT NULL,
      PRIMARY KEY (key, idx)
    );
  `,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await executeStatements(
    db,
    `
    DROP TABLE IF EXISTS blob_chunks, blobs, integrations, app_config, audit_log, build_events,
      builds, device_events, devices, channel_events, channels, native_builds, bundles, api_keys,
      app_permissions, app_identifiers, apps, invitations, organization_members, organizations,
      sessions, users CASCADE;
  `,
  );
}
