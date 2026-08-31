/**
 * A device as `GET /api/dashboard/devices` returns it.
 *
 * Not everything declared here is returned. The fields marked below are read by
 * components but never sent by the API and exist on no table, so they are
 * permanently undefined - the device detail page showed "N/A" for its two
 * headline cards because of exactly this. They are kept rather than deleted
 * because other screens still reference them, and removing them would hide the
 * problem rather than fix it.
 */
export interface Device {
  id: string;
  device_id: string;
  app_id?: string;
  platform: "android" | "ios";
  channel?: string;
  custom_channel?: string; // If overridden

  /**
   * NOT RETURNED BY THE API, and no such column exists. The applied bundle is
   * `version_name` and the native build is `version_build`.
   *
   * Still read by `DevicesMap`'s tooltip and by `updates-bundles/[id].vue`,
   * which uses both to work out which devices are on a given release - so that
   * screen currently believes no device is on anything.
   */
  current_bundle_id?: string;
  current_native_id?: string;

  /** `devices.last_seen`, renamed by the controller. */
  last_check?: string;
  created_at?: string;
  updated_at?: string;
  /**
   * Real GPS, from migration 009 - present only for a device whose app opted
   * into `collectLocation` and whose OS granted permission. Absent, not a
   * fake value: `DevicesMap` used to fill this in with a hash of `device_id`
   * mapped onto a fixed geographic box, so two devices in the same real place
   * could land hundreds of km apart. There is no fallback here on purpose.
   */
  latitude?: number;
  longitude?: number;
  location_accuracy_m?: number;
  location_reported_at?: string;
  device_name?: string; // Device.getInfo().name, e.g. "Redmi Note 14"
  manufacturer?: string;
  model?: string; // e.g. "24117RN76G" - not human-readable, device_name is
  /** The app's own memory footprint. Not total device RAM - no plugin reports that. */
  mem_used_bytes?: number;
  // Version tracking
  version_name?: string; // Applied OTA bundle version, absent until one lands
  version_build?: string; // Native build number of the installed binary (e.g. "67")
  version_builtin?: string; // Bundle version compiled into that binary
  /** NOT RETURNED BY THE API. `version_build` already carries the build number. */
  version_code?: string;
  version_os?: string; // OS version. There is no device model anywhere.
  // Plugin info
  plugin_version?: string; // OTA plugin version
  is_emulator?: boolean;
  is_prod?: boolean;
  // Stats
  last_stats_action?: string; // Last action (first_open, app_moved_to_foreground, etc.)
  last_stats_at?: string; // Timestamp of last stats event
}
