import { sql } from "kysely";
import type { Db } from "../db/database";

/** How many of a channel's devices run each web version, `builtin` when none was applied. */
export function channelVersionMix(db: Db, channelId: string) {
  return db
    .selectFrom("devices")
    .select([
      sql<string>`coalesce(nullif(version_name, ''), 'builtin')`.as("version"),
      (eb) => eb.fn.countAll<string>().as("devices"),
      (eb) => eb.fn.max("last_seen_at").as("last_seen_at"),
    ])
    .where("channel_id", "=", channelId)
    .groupBy(sql`1`)
    .orderBy(sql`2`, "desc")
    .execute();
}

/** The channel's most recently seen devices not running `version`. */
export function devicesBehind(db: Db, channelId: string, version: string | null, limit: number) {
  let query = db
    .selectFrom("devices")
    .select([
      "id",
      "device_id",
      "custom_id",
      "device_name",
      "model",
      "attributes",
      "version_name",
      "last_seen_at",
    ])
    .where("channel_id", "=", channelId);
  if (version) query = query.where(sql<boolean>`version_name IS DISTINCT FROM ${version}`);
  return query.orderBy("last_seen_at", "desc").limit(limit).execute();
}

/** When, and by whom, the channel last moved to `bundleId`. */
export function lastMoveTo(db: Db, channelId: string, bundleId: string) {
  return db
    .selectFrom("channel_events as e")
    .leftJoin("users", "users.id", "e.actor_user_id")
    .select(["e.action", "e.created_at", "e.from_version", "users.email as actor_email"])
    .where("e.channel_id", "=", channelId)
    .where("e.to_id", "=", bundleId)
    .where("e.action", "in", ["point_bundle", "rollback_bundle"])
    .orderBy("e.id", "desc")
    .limit(1)
    .executeTakeFirst();
}

/** Devices whose first delivery of `version` on the channel fell on each local day since `since`. */
export function firstDeliveriesPerDay(
  db: Db,
  query: { channelId: string; version: string; since: Date; tz: string },
) {
  return sql<{ day: string; devices: string }>`
    WITH firsts AS (
      SELECT device_uuid, min(created_at) AS at
        FROM device_events
       WHERE channel_id = ${query.channelId}
         AND category = 'delivered'
         AND version_to = ${query.version}
         AND created_at >= ${query.since}
         AND device_uuid IS NOT NULL
       GROUP BY device_uuid
    )
    SELECT to_char(date_trunc('day', at AT TIME ZONE ${query.tz}), 'YYYY-MM-DD') AS day,
           count(*) AS devices
      FROM firsts
     GROUP BY 1
     ORDER BY 1
  `
    .execute(db)
    .then((result) => result.rows);
}
