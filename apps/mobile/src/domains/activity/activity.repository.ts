import type { Kysely, Selectable, Transaction } from "kysely";
import type { ActivityTable, Database } from "@/shared/database/schema";

type Db = Kysely<Database> | Transaction<Database>;

export type Activity = Selectable<ActivityTable>;

/** Ignores a fact already recorded, so the sync and the live stream can both report it. */
export async function recordActivity(db: Db, rows: ActivityTable[]): Promise<number> {
  let written = 0;
  for (let index = 0; index < rows.length; index += 50) {
    const result = await db
      .insertInto("activity")
      .values(rows.slice(index, index + 50))
      .onConflict((oc) => oc.column("id").doNothing())
      .executeTakeFirst();
    written += Number(result.numInsertedOrUpdatedRows ?? 0);
  }
  return written;
}

export interface ActivityRow extends Activity {
  app_name: string;
  app_bundle_id: string;
}

export function listActivity(db: Db, appId?: string, limit = 200): Promise<ActivityRow[]> {
  let query = db
    .selectFrom("activity")
    .innerJoin("app", "app.id", "activity.app_id")
    .selectAll("activity")
    .select(["app.name as app_name", "app.bundle_id as app_bundle_id"]);
  if (appId) query = query.where("activity.app_id", "=", appId);
  return query.orderBy("activity.created_at", "desc").limit(limit).execute();
}

export function listAppActivity(db: Db, appId: string, limit = 20): Promise<Activity[]> {
  return db
    .selectFrom("activity")
    .selectAll()
    .where("app_id", "=", appId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .execute();
}

export async function countUnread(db: Db, appId?: string): Promise<number> {
  let query = db
    .selectFrom("activity")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("read_at", "is", null);
  if (appId) query = query.where("app_id", "=", appId);
  const row = await query.executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function markAllRead(db: Db, at: string, appId?: string): Promise<void> {
  let query = db.updateTable("activity").set({ read_at: at }).where("read_at", "is", null);
  if (appId) query = query.where("app_id", "=", appId);
  await query.execute();
}
