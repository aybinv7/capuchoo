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
  versionBuiltin?: string | undefined;
  pluginVersion?: string | undefined;
  isProd?: boolean | undefined;
  isEmulator?: boolean | undefined;
  customId?: string | undefined;
  deviceName?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  memUsedBytes?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  locationAccuracy?: number | undefined;
}

/**
 * The columns migration 009 adds. Named here, once, so the tolerant-write
 * retry in `deviceService` drops exactly these and nothing else when the
 * migration has not run yet - the same shape as `flavourGuard`'s single-column
 * tolerance, generalised because this ships nine columns at once rather than
 * one.
 */
export const DEVICE_DIAGNOSTICS_COLUMNS = [
  "device_name",
  "manufacturer",
  "model",
  "mem_used_bytes",
  "latitude",
  "longitude",
  "location_accuracy_m",
  "location_reported_at",
] as const;

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
    ["version_builtin", normalizeVersion(observation.versionBuiltin)],
    ["plugin_version", observation.pluginVersion],
    ["is_prod", observation.isProd],
    ["is_emulator", observation.isEmulator],
    ["custom_id", observation.customId],
    ["device_name", observation.deviceName],
    ["manufacturer", observation.manufacturer],
    ["model", observation.model],
    ["mem_used_bytes", observation.memUsedBytes],
  ];

  // Both or neither: a latitude with no longitude is not a location, and
  // writing one would put a point on the map that names half a place.
  if (typeof observation.latitude === "number" && typeof observation.longitude === "number") {
    row.latitude = observation.latitude;
    row.longitude = observation.longitude;
    row.location_reported_at = now;
    if (typeof observation.locationAccuracy === "number") {
      row.location_accuracy_m = observation.locationAccuracy;
    }
  }

  for (const [column, value] of optional) {
    if (value !== undefined && value !== null && value !== "") {
      row[column] = value;
    }
  }

  return row;
}
