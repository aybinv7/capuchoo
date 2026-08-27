-- Give an API key a role ceiling.
--
-- A key is the account acting through a machine, so until now it carried the
-- account's full rights: a CI credential could administer, not just publish.
-- `role` caps what the key may do; the effective role is the weaker of the
-- account's role on the app and this value.
--
-- NULL means uncapped - the account's own rights - which is what every existing
-- key gets, so nothing changes behaviour until a capped key is issued.
--
-- Safe to re-run.

ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS role VARCHAR(50);

ALTER TABLE api_keys
    DROP CONSTRAINT IF EXISTS api_keys_role_check;

ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_role_check CHECK (
        role IS NULL OR role IN ('admin', 'developer', 'tester', 'viewer')
    );

COMMENT ON COLUMN api_keys.role IS
    'Ceiling on what this key may do. NULL = the account''s own rights.';
