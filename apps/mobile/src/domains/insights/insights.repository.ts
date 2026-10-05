import type { Kysely, Selectable, Transaction } from "kysely";
import type { AppStats } from "@/shared/api/types";
import type { AppStatsTable, Database, DeviceTable } from "@/shared/database/schema";

type Db = Kysely<Database> | Transaction<Database>;

export type Device = Selectable<DeviceTable>;

const CHUNK = 40;

/** The app's devices as the server listed them now; one that stopped reporting is gone with it. */
export async function replaceDevices(db: Db, appId: string, rows: DeviceTable[]): Promise<void> {
  await db.deleteFrom("device").where("app_id", "=", appId).execute();
  for (let index = 0; index < rows.length; index += CHUNK)
    await db
      .insertInto("device")
      .values(rows.slice(index, index + CHUNK))
      .execute();
}

export function listDevices(db: Db, appId: string): Promise<Device[]> {
  return db
    .selectFrom("device")
    .selectAll()
    .where("app_id", "=", appId)
    .orderBy("last_seen_at", "desc")
    .execute();
}

export function getDevice(db: Db, deviceId: string): Promise<Device | undefined> {
  return db.selectFrom("device").selectAll().where("id", "=", deviceId).executeTakeFirst();
}

export async function deleteDeviceRow(db: Db, deviceId: string): Promise<void> {
  await db.deleteFrom("device").where("id", "=", deviceId).execute();
}

export async function saveStats(db: Db, row: AppStatsTable): Promise<void> {
  await db
    .insertInto("app_stats")
    .values(row)
    .onConflict((oc) =>
      oc.columns(["app_id", "days"]).doUpdateSet((eb) => ({
        payload: eb.ref("excluded.payload"),
        synced_at: eb.ref("excluded.synced_at"),
      })),
    )
    .execute();
}

export interface StoredStats {
  stats: AppStats;
  syncedAt: string;
}

export async function getStats(db: Db, appId: string, days: number): Promise<StoredStats | null> {
  const row = await db
    .selectFrom("app_stats")
    .selectAll()
    .where("app_id", "=", appId)
    .where("days", "=", days)
    .executeTakeFirst();
  if (!row) return null;
  try {
    return { stats: JSON.parse(row.payload) as AppStats, syncedAt: row.synced_at };
  } catch {
    return null;
  }
}
