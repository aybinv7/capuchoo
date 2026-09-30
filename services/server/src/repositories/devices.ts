import { sql } from "kysely";
import type { Db } from "../db/database";
import type { Device, PlatformColumn } from "../db/schema";

export interface DeviceObservation {
  appId: string;
  deviceId: string;
  platform: PlatformColumn;
  customId?: string | undefined;
  isProd?: boolean | undefined;
  isEmulator?: boolean | undefined;
  versionName?: string | undefined;
  versionBuiltin?: string | undefined;
  versionCode?: number | undefined;
  versionOs?: string | undefined;
  pluginVersion?: string | undefined;
  reportedChannel?: string | undefined;
  channelId?: string | null | undefined;
  deviceName?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  memUsedBytes?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  locationAccuracy?: number | undefined;
}

const clip = (value: string | undefined, max = 120): string | undefined =>
  value === undefined || value === "" ? undefined : value.slice(0, max);

/** One statement per check: insert or merge the facts the device reported, never erase known ones. */
export async function upsertDevice(
  db: Db,
  observation: DeviceObservation,
  now: Date,
): Promise<Device> {
  const located =
    typeof observation.latitude === "number" &&
    typeof observation.longitude === "number" &&
    Math.abs(observation.latitude) <= 90 &&
    Math.abs(observation.longitude) <= 180;

  const values = {
    app_id: observation.appId,
    device_id: observation.deviceId.slice(0, 255),
    platform: observation.platform,
    custom_id: clip(observation.customId, 255) ?? null,
    is_prod: observation.isProd ?? null,
    is_emulator: observation.isEmulator ?? null,
    version_name: clip(observation.versionName, 64) ?? null,
    version_builtin: clip(observation.versionBuiltin, 64) ?? null,
    version_code: observation.versionCode ?? null,
    version_os: clip(observation.versionOs, 64) ?? null,
    plugin_version: clip(observation.pluginVersion, 64) ?? null,
    reported_channel: clip(observation.reportedChannel, 64) ?? null,
    channel_id: observation.channelId ?? null,
    device_name: clip(observation.deviceName) ?? null,
    manufacturer: clip(observation.manufacturer) ?? null,
    model: clip(observation.model) ?? null,
    mem_used_bytes: observation.memUsedBytes ?? null,
    latitude: located ? observation.latitude! : null,
    longitude: located ? observation.longitude! : null,
    location_accuracy_m: located ? (observation.locationAccuracy ?? null) : null,
    location_reported_at: located ? now : null,
    last_seen_at: now,
    updated_at: now,
  };

  const keep = (column: keyof typeof values) =>
    sql<never>`coalesce(excluded.${sql.ref(column)}, devices.${sql.ref(column)})`;

  return db
    .insertInto("devices")
    .values(values)
    .onConflict((oc) =>
      oc.columns(["app_id", "device_id"]).doUpdateSet({
        platform: (eb) => eb.ref("excluded.platform"),
        custom_id: keep("custom_id"),
        is_prod: keep("is_prod"),
        is_emulator: keep("is_emulator"),
        version_name: keep("version_name"),
        version_builtin: keep("version_builtin"),
        version_code: keep("version_code"),
        version_os: keep("version_os"),
        plugin_version: keep("plugin_version"),
        reported_channel: keep("reported_channel"),
        channel_id: keep("channel_id"),
        device_name: keep("device_name"),
        manufacturer: keep("manufacturer"),
        model: keep("model"),
        mem_used_bytes: keep("mem_used_bytes"),
        latitude: keep("latitude"),
        longitude: keep("longitude"),
        location_accuracy_m: keep("location_accuracy_m"),
        location_reported_at: keep("location_reported_at"),
        last_seen_at: (eb) => eb.ref("excluded.last_seen_at"),
        updated_at: (eb) => eb.ref("excluded.updated_at"),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findDevice(db: Db, appId: string, deviceId: string): Promise<Device | undefined> {
  return db
    .selectFrom("devices")
    .selectAll()
    .where("app_id", "=", appId)
    .where("device_id", "=", deviceId)
    .executeTakeFirst();
}

export function findDeviceById(db: Db, id: string): Promise<Device | undefined> {
  return db.selectFrom("devices").selectAll().where("id", "=", id).executeTakeFirst();
}

export interface DeviceListQuery {
  appId: string;
  channelId?: string | undefined;
  search?: string | undefined;
  activeSince?: Date | undefined;
  limit: number;
  offset: number;
}

export async function listDevices(db: Db, query: DeviceListQuery) {
  let base = db.selectFrom("devices").where("devices.app_id", "=", query.appId);
  if (query.channelId) base = base.where("devices.channel_id", "=", query.channelId);
  if (query.activeSince) base = base.where("devices.last_seen_at", ">=", query.activeSince);
  if (query.search) {
    const term = `%${query.search.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
    base = base.where((eb) =>
      eb.or([
        eb("devices.device_id", "ilike", term),
        eb("devices.custom_id", "ilike", term),
        eb("devices.model", "ilike", term),
        eb("devices.device_name", "ilike", term),
      ]),
    );
  }
  const [rows, total] = await Promise.all([
    base
      .leftJoin("channels", "channels.id", "devices.channel_id")
      .selectAll("devices")
      .select("channels.name as channel_name")
      .orderBy("devices.last_seen_at", "desc")
      .limit(query.limit)
      .offset(query.offset)
      .execute(),
    base.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
  ]);
  return { rows, total: Number(total.count) };
}

export async function assignDeviceChannel(
  db: Db,
  id: string,
  channelId: string | null,
): Promise<Device> {
  return db
    .updateTable("devices")
    .set({ assigned_channel_id: channelId, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function setSelfChannel(db: Db, id: string, channelId: string | null): Promise<void> {
  await db
    .updateTable("devices")
    .set({ self_channel_id: channelId, updated_at: new Date() })
    .where("id", "=", id)
    .execute();
}

export async function deleteDevice(db: Db, id: string): Promise<void> {
  await db.deleteFrom("devices").where("id", "=", id).execute();
}
