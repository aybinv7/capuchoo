import { sql } from "kysely";
import type { Db } from "../db/database";

export interface NewDeviceEvent {
  appId: string;
  deviceUuid: string | null;
  channelId: string | null;
  kind: "ota" | "native" | "check";
  action: string;
  status?: string | null | undefined;
  versionFrom?: string | null | undefined;
  versionTo?: string | null | undefined;
  versionCodeTo?: number | null | undefined;
  error?: string | null | undefined;
  details?: Record<string, unknown> | undefined;
}

export async function insertDeviceEvents(db: Db, events: NewDeviceEvent[]): Promise<void> {
  if (events.length === 0) return;
  await db
    .insertInto("device_events")
    .values(
      events.map((event) => ({
        app_id: event.appId,
        device_uuid: event.deviceUuid,
        channel_id: event.channelId,
        kind: event.kind,
        action: event.action.slice(0, 64),
        status: event.status ?? null,
        version_from: event.versionFrom?.slice(0, 64) ?? null,
        version_to: event.versionTo?.slice(0, 64) ?? null,
        version_code_to: event.versionCodeTo ?? null,
        error: event.error?.slice(0, 1000) ?? null,
        details: event.details ? JSON.stringify(event.details) : null,
      })),
    )
    .execute();
}

export function listDeviceEvents(
  db: Db,
  query: {
    appId: string;
    channelId?: string | undefined;
    deviceUuid?: string | undefined;
    limit: number;
    before?: string | undefined;
  },
) {
  let base = db
    .selectFrom("device_events as e")
    .leftJoin("devices", "devices.id", "e.device_uuid")
    .leftJoin("channels", "channels.id", "e.channel_id")
    .select([
      "e.id",
      "e.kind",
      "e.action",
      "e.status",
      "e.version_from",
      "e.version_to",
      "e.version_code_to",
      "e.error",
      "e.created_at",
      "devices.device_id",
      "devices.model",
      "channels.name as channel_name",
    ])
    .where("e.app_id", "=", query.appId);
  if (query.channelId) base = base.where("e.channel_id", "=", query.channelId);
  if (query.deviceUuid) base = base.where("e.device_uuid", "=", query.deviceUuid);
  if (query.before) base = base.where("e.id", "<", query.before);
  return base.orderBy("e.id", "desc").limit(query.limit).execute();
}

export interface ChannelHealth {
  channel_id: string;
  devices: number;
  active_24h: number;
  on_current: number;
  installs_24h: number;
  failures_24h: number;
  installs_7d: number;
  failures_7d: number;
}

/** Per-channel adoption and outcome counts, computed in SQL so it holds at any volume. */
export async function channelHealth(db: Db, appId: string, now: Date): Promise<ChannelHealth[]> {
  const day = new Date(now.getTime() - 24 * 3600 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const result = await sql<{
    channel_id: string;
    devices: string;
    active_24h: string;
    on_current: string;
    installs_24h: string;
    failures_24h: string;
    installs_7d: string;
    failures_7d: string;
  }>`
    WITH device_counts AS (
      SELECT d.channel_id,
             count(*) AS devices,
             count(*) FILTER (WHERE d.last_seen_at >= ${day}) AS active_24h,
             count(*) FILTER (WHERE b.version_name IS NOT NULL AND d.version_name = b.version_name) AS on_current
        FROM devices d
        JOIN channels c ON c.id = d.channel_id
        LEFT JOIN bundles b ON b.id = c.current_bundle_id
       WHERE d.app_id = ${appId}
       GROUP BY d.channel_id
    ),
    event_counts AS (
      SELECT e.channel_id,
             count(*) FILTER (WHERE e.status = 'delivered' AND e.created_at >= ${day}) AS installs_24h,
             count(*) FILTER (WHERE e.status = 'failed' AND e.created_at >= ${day}) AS failures_24h,
             count(*) FILTER (WHERE e.status = 'delivered') AS installs_7d,
             count(*) FILTER (WHERE e.status = 'failed') AS failures_7d
        FROM device_events e
       WHERE e.app_id = ${appId} AND e.created_at >= ${week} AND e.channel_id IS NOT NULL
       GROUP BY e.channel_id
    )
    SELECT c.id AS channel_id,
           coalesce(dc.devices, 0) AS devices,
           coalesce(dc.active_24h, 0) AS active_24h,
           coalesce(dc.on_current, 0) AS on_current,
           coalesce(ec.installs_24h, 0) AS installs_24h,
           coalesce(ec.failures_24h, 0) AS failures_24h,
           coalesce(ec.installs_7d, 0) AS installs_7d,
           coalesce(ec.failures_7d, 0) AS failures_7d
      FROM channels c
      LEFT JOIN device_counts dc ON dc.channel_id = c.id
      LEFT JOIN event_counts ec ON ec.channel_id = c.id
     WHERE c.app_id = ${appId}
  `.execute(db);
  return result.rows.map((row) => ({
    channel_id: row.channel_id,
    devices: Number(row.devices),
    active_24h: Number(row.active_24h),
    on_current: Number(row.on_current),
    installs_24h: Number(row.installs_24h),
    failures_24h: Number(row.failures_24h),
    installs_7d: Number(row.installs_7d),
    failures_7d: Number(row.failures_7d),
  }));
}

/** Daily event counts for the statistics view. */
export async function dailyActivity(db: Db, appId: string, since: Date) {
  const result = await sql<{
    day: string;
    checks: string;
    installs: string;
    failures: string;
    devices: string;
  }>`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           count(*) FILTER (WHERE kind = 'check') AS checks,
           count(*) FILTER (WHERE status = 'delivered') AS installs,
           count(*) FILTER (WHERE status = 'failed') AS failures,
           count(DISTINCT device_uuid) AS devices
      FROM device_events
     WHERE app_id = ${appId} AND created_at >= ${since}
     GROUP BY 1
     ORDER BY 1
  `.execute(db);
  return result.rows.map((row) => ({
    day: row.day,
    checks: Number(row.checks),
    installs: Number(row.installs),
    failures: Number(row.failures),
    devices: Number(row.devices),
  }));
}

/** Version distribution of devices seen in the window. */
export async function versionDistribution(db: Db, appId: string, since: Date) {
  const result = await sql<{ version: string; platform: string; devices: string }>`
    SELECT coalesce(version_name, 'builtin') AS version, platform, count(*) AS devices
      FROM devices
     WHERE app_id = ${appId} AND last_seen_at >= ${since}
     GROUP BY 1, 2
     ORDER BY 3 DESC
     LIMIT 50
  `.execute(db);
  return result.rows.map((row) => ({
    version: row.version,
    platform: row.platform,
    devices: Number(row.devices),
  }));
}

export async function purgeDeviceEvents(db: Db, olderThan: Date): Promise<number> {
  const result = await db
    .deleteFrom("device_events")
    .where("created_at", "<", olderThan)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}
