-- Migration: record the bundle version compiled into the binary
-- Description: `devices.version_name` is the *applied OTA bundle*, which is
--              null until an update lands. The builtin version is what the
--              binary shipped with, and the pair together answer "has this
--              device ever taken an update, and from where" - which neither
--              column answers alone.
-- Created: 2026-08-22

ALTER TABLE devices ADD COLUMN IF NOT EXISTS version_builtin VARCHAR(50);

COMMENT ON COLUMN devices.version_builtin IS
  'Web bundle version compiled into the installed binary, from the plugin''s getBuiltinVersion(). Distinct from version_name, which is the OTA bundle currently applied.';
