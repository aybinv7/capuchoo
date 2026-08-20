-- Migration: Make the device telemetry path writable
-- Description: `devices` is the table device_channels, update_logs and
--              native_update_logs all reference by foreign key. It is defined
--              in schema.sql but the backend never wrote to it, so it may be
--              missing on a database that was assembled by hand. Everything
--              here is idempotent, and the two unique constraints are what the
--              new upserts key on - without them ON CONFLICT has nothing to
--              match and every write fails.
-- Created: 2026-08-20

-- 1. The table itself, if it was never created.
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) NOT NULL,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,

    custom_id VARCHAR(255),
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    is_prod BOOLEAN NOT NULL DEFAULT true,
    is_emulator BOOLEAN NOT NULL DEFAULT false,

    version_name VARCHAR(50),
    version_build VARCHAR(50),
    version_os VARCHAR(50),
    plugin_version VARCHAR(50),

    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    channel_override VARCHAR(100),

    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. The conflict targets the upserts need.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'devices_app_id_device_id_key'
    ) THEN
        ALTER TABLE devices ADD CONSTRAINT devices_app_id_device_id_key UNIQUE (app_id, device_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'device_channels_device_id_channel_id_key'
    ) THEN
        ALTER TABLE device_channels
        ADD CONSTRAINT device_channels_device_id_channel_id_key UNIQUE (device_id, channel_id);
    END IF;
END $$;

-- 3. The lookups the update path performs on every check.
CREATE INDEX IF NOT EXISTS idx_devices_app_device ON devices(app_id, device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_devices_channel ON devices(channel_id);
