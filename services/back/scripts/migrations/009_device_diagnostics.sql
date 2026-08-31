-- Migration: device diagnostics and on-device location
-- Description: `devices` gains the fields a check can now report: name,
--              manufacturer, model and the app's own memory footprint from
--              `@capacitor/device`, and GPS coordinates from
--              `@capacitor/geolocation` when the host app has opted in and the
--              OS has granted permission.
--
--              Deliberately absent: total device RAM and free/total device
--              storage. No plugin in this project's supported dependency set
--              reports either - `@capacitor/device` in the 7-9 range exposes
--              only `memUsed`, the app's own usage, not the device's total. A
--              column for numbers nobody sends would be an invitation to fill
--              it with something approximate later.
--
--              Latitude and longitude are written together or not at all -
--              `buildDeviceRow` enforces that - so `location_reported_at` is
--              null exactly when there is no location, and a device that once
--              reported one but has since had permission revoked keeps its
--              last known point rather than losing it, timestamped so it can
--              be told apart from a fresh one.
-- Created: 2026-08-31

ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS mem_used_bytes BIGINT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS location_reported_at TIMESTAMPTZ;

COMMENT ON COLUMN devices.device_name IS
  'Device.getInfo().name, e.g. "Redmi Note 14". Not supported on iOS 16+, which returns a generic name.';
COMMENT ON COLUMN devices.mem_used_bytes IS
  'The APP''s own memory footprint from Device.getInfo().memUsed. Not total device RAM - no plugin in this project reports that.';
COMMENT ON COLUMN devices.latitude IS
  'On-device GPS, sent only when the host app opted in via collectLocation and the OS granted permission. Null means no location was ever reported, not (0, 0).';
COMMENT ON COLUMN devices.location_reported_at IS
  'When latitude/longitude were last written. Distinct from updated_at so a stale location (permission later revoked) is identifiable.';
