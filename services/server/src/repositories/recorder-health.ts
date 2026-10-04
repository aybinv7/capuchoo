import type { RecorderHealth } from "@capuchoo/core";
import type { Db } from "../db/database";

/** A device writes its health at least every two minutes while it runs. */
export const RECORDER_ONLINE_MS = 3 * 60_000;

export interface RecorderHealthWrite {
  appId: string;
  deviceId: string;
  deviceUuid: string | null;
  platform: string;
  versionName: string;
  channel: string | null;
  health: RecorderHealth;
  seenAt: Date;
}

export async function upsertRecorderHealth(db: Db, row: RecorderHealthWrite): Promise<void> {
  const values = {
    device_uuid: row.deviceUuid,
    platform: row.platform,
    version_name: row.versionName,
    channel: row.channel,
    health: JSON.stringify(row.health),
    seen_at: row.seenAt,
  };
  await db
    .insertInto("recorder_health")
    .values({ app_id: row.appId, device_id: row.deviceId, ...values })
    .onConflict((conflict) => conflict.columns(["app_id", "device_id"]).doUpdateSet(values))
    .execute();
}

export function listRecorderHealth(db: Db, appId: string, limit: number) {
  return db
    .selectFrom("recorder_health")
    .leftJoin("devices", "devices.id", "recorder_health.device_uuid")
    .select([
      "recorder_health.device_id",
      "recorder_health.device_uuid",
      "recorder_health.platform",
      "recorder_health.version_name",
      "recorder_health.channel",
      "recorder_health.health",
      "recorder_health.seen_at",
      "devices.custom_id",
      "devices.model",
      "devices.manufacturer",
    ])
    .where("recorder_health.app_id", "=", appId)
    .orderBy("recorder_health.seen_at", "desc")
    .limit(limit)
    .execute();
}

export async function deleteRecorderHealthBefore(db: Db, cutoff: Date): Promise<number> {
  const result = await db
    .deleteFrom("recorder_health")
    .where("seen_at", "<", cutoff)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}
