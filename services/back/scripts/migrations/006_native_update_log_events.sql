-- Widen native_update_logs.event to the events the contract actually sends.
--
-- The column was created with
--     CHECK (event IN ('check', 'download', 'install', 'fail', 'skip'))
-- while @capuchoo/core has always declared
--     'check' | 'download' | 'download_complete' | 'install' | 'cancel' | 'error'
--
-- Three of the six were rejected by the database. A device reports
-- `download_complete` after every native download, so that insert raised a
-- constraint violation and the endpoint answered 500 - on the single most
-- common event it receives. Nobody saw it because the app runtime catches a
-- failed telemetry post and warns to a console.
--
-- `fail` and `skip` are kept so rows already written under the old vocabulary
-- stay valid; nothing emits them.
--
-- Safe to re-run.

ALTER TABLE native_update_logs
    DROP CONSTRAINT IF EXISTS native_update_logs_event_check;

ALTER TABLE native_update_logs
    ADD CONSTRAINT native_update_logs_event_check CHECK (
        event IN (
            'check',
            'download',
            'download_complete',
            'install',
            'cancel',
            'error',
            -- historical, still present in existing rows
            'fail',
            'skip'
        )
    );
