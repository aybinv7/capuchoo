-- Separate an application's identity from the bundle identifiers it ships under.
--
-- `apps.app_id` was both the primary way to find an app and, by its spelling,
-- the way the server guessed which flavour a binary was: anything ending
-- `.dev` or `.staging` was treated as that flavour, anything else as production.
-- Two consequences, both live:
--
--   * An app that builds every flavour from one identifier - the default
--     Capacitor setup, and what com.ayb.lowmaro does - looked like production in
--     all three, so its dev channel could never be served. Nothing was wrong
--     with the data; the identifier simply had no suffix to read.
--   * An app that does suffix per flavour needed a separate Capuchoo app per
--     identifier, because app_id is unique. That splits its channels, devices
--     and statistics three ways and makes promoting a bundle from staging to
--     prod impossible.
--
-- One app now owns many identifiers, each declaring its own flavour. `flavour`
-- IS NULL means "every flavour ships under this identifier", which is a real
-- answer and not a missing one - it is what turns the flavour gate off for apps
-- that cannot meaningfully have one.
--
-- Existing rows are backfilled with NULL rather than with the old guess. A
-- suffix is not a declaration, and inheriting the guess would carry the bug
-- forward into the table built to remove it.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS app_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,

    -- Unique across the installation, as apps.app_id was: a device reports only
    -- the identifier compiled into it, so two apps claiming one identifier
    -- would be unresolvable.
    bundle_id VARCHAR(255) UNIQUE NOT NULL,

    platform VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (platform IN ('android', 'ios', 'all')),
    flavour VARCHAR(20) CHECK (flavour IN ('prod', 'staging', 'dev')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_identifiers_app ON app_identifiers(app_id);

-- One identifier per flavour per platform. A partial index, because NULL is not
-- equal to NULL in a UNIQUE constraint and the shared row must still be unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_identifiers_flavour
    ON app_identifiers(app_id, platform, flavour)
    WHERE flavour IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_identifiers_shared
    ON app_identifiers(app_id, platform)
    WHERE flavour IS NULL;

-- Backfill: every existing app keeps working, resolved through the new table.
INSERT INTO app_identifiers (app_id, bundle_id, platform, flavour)
SELECT a.id, a.app_id, COALESCE(a.platform, 'all'), NULL
FROM apps a
WHERE NOT EXISTS (
    SELECT 1 FROM app_identifiers i WHERE i.bundle_id = a.app_id
);

-- `environment` has been read by the server since channels were introduced and
-- is absent from schema.sql, so a database built from that file has never had
-- it. Recorded here rather than left to whoever notices.
ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS environment VARCHAR(20);

ALTER TABLE channels
    DROP CONSTRAINT IF EXISTS channels_environment_check;

ALTER TABLE channels
    ADD CONSTRAINT channels_environment_check CHECK (
        environment IS NULL OR environment IN ('prod', 'staging', 'dev')
    );

-- The flavour a bundle was built from, so "every bundle in a channel came from
-- one flavour" is checkable rather than assumed. NULL on existing rows: they
-- were uploaded before anything declared it.
ALTER TABLE app_versions
    ADD COLUMN IF NOT EXISTS flavour VARCHAR(20);

ALTER TABLE app_versions
    DROP CONSTRAINT IF EXISTS app_versions_flavour_check;

ALTER TABLE app_versions
    ADD CONSTRAINT app_versions_flavour_check CHECK (
        flavour IS NULL OR flavour IN ('prod', 'staging', 'dev')
    );

ALTER TABLE native_updates
    ADD COLUMN IF NOT EXISTS flavour VARCHAR(20);

ALTER TABLE native_updates
    DROP CONSTRAINT IF EXISTS native_updates_flavour_check;

ALTER TABLE native_updates
    ADD CONSTRAINT native_updates_flavour_check CHECK (
        flavour IS NULL OR flavour IN ('prod', 'staging', 'dev')
    );

COMMENT ON TABLE app_identifiers IS
    'Bundle identifiers an app ships under. flavour IS NULL means every flavour uses this one.';
COMMENT ON COLUMN app_identifiers.flavour IS
    'Which flavour ships under this identifier, or NULL when all of them do.';
COMMENT ON COLUMN channels.environment IS
    'The flavour whose builds this channel serves.';
