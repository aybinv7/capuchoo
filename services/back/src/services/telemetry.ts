/**
 * Pure helpers for the device telemetry path.
 *
 * Kept free of imports so they can be tested without a Supabase client or the
 * environment validation that `@/config` performs at import time.
 */

export interface DeviceObservation {
  /** apps.id */
  appUuid: string;
  /** The plugin's device identifier, e.g. from Capacitor's Device plugin */
  deviceId: string;
  platform?: string | undefined;
  channelId?: string | null | undefined;
  channelOverride?: string | null | undefined;
  versionName?: string | undefined;
  versionBuild?: string | undefined;
  versionOs?: string | undefined;
  pluginVersion?: string | undefined;
  isProd?: boolean | undefined;
  isEmulator?: boolean | undefined;
  customId?: string | undefined;
}

/**
 * `"builtin"` is the plugin's sentinel for "running the version shipped in the
 * binary", and `"unknown"` is what the old stats path wrote when it could not
 * find a version. Neither belongs in a version column.
 */
export function normalizeVersion(value: string | undefined | null): string | undefined {
  if (!value || value === "builtin" || value === "unknown") return undefined;
  return value;
}

/**
 * The version a stats call is reporting.
 *
 * The plugin sends `version_name`; the field normalizer maps that to `version`,
 * and `statsController` forwards only `version`. `logStats` read
 * `stats.version_name`, which is undefined on that path - so every row it wrote
 * said "unknown".
 */
export function statsVersion(stats: {
  version_name?: string | undefined;
  version?: string | undefined;
  bundleId?: string | undefined;
}): string | null {
  return normalizeVersion(stats.version_name || stats.version || stats.bundleId) ?? null;
}

/**
 * Build the row to upsert into `devices`, keeping only the fields the caller
 * actually knows.
 *
 * A stats call and an update check carry different subsets of the device state,
 * and an upsert writes exactly the keys it is given - so omitting an unknown
 * field preserves whatever an earlier, better-informed call stored, while
 * sending `undefined` would blank it.
 */
export function buildDeviceRow(
  observation: DeviceObservation,
  now: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    app_id: observation.appUuid,
    device_id: observation.deviceId,
    last_seen: now,
    updated_at: now,
  };

  const optional: Array<[string, unknown]> = [
    ["platform", observation.platform],
    ["channel_id", observation.channelId],
    ["channel_override", observation.channelOverride],
    ["version_name", normalizeVersion(observation.versionName)],
    ["version_build", normalizeVersion(observation.versionBuild)],
    ["version_os", observation.versionOs],
    ["plugin_version", observation.pluginVersion],
    ["is_prod", observation.isProd],
    ["is_emulator", observation.isEmulator],
    ["custom_id", observation.customId],
  ];

  for (const [column, value] of optional) {
    if (value !== undefined && value !== null && value !== "") {
      row[column] = value;
    }
  }

  return row;
}
