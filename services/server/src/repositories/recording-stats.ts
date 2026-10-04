import { compareVersions } from "@capuchoo/core";
import { sql } from "kysely";
import type { Db } from "../db/database";

/** A session counts once it has stored a segment, as in the session list. */
const STORED = sql`segment_count > 0`;

export async function sessionTotals(db: Db, appId: string, since: Date, liveSince: Date) {
  const result = await sql<{
    sessions: string;
    error_sessions: string;
    reports: string;
    devices: string;
    bytes: string;
    duration_ms: string;
    live_now: string;
  }>`
    SELECT count(*) AS sessions,
           count(*) FILTER (WHERE error_count > 0) AS error_sessions,
           count(*) FILTER (WHERE note IS NOT NULL) AS reports,
           count(DISTINCT device_id) AS devices,
           coalesce(sum(size_bytes), 0) AS bytes,
           coalesce(sum(extract(epoch FROM (ended_at - started_at)) * 1000), 0) AS duration_ms,
           count(*) FILTER (WHERE NOT finished AND last_segment_at >= ${liveSince}) AS live_now
      FROM recording_sessions
     WHERE app_id = ${appId} AND started_at >= ${since} AND ${STORED}
  `.execute(db);
  const row = result.rows[0];
  return {
    sessions: Number(row?.sessions ?? 0),
    error_sessions: Number(row?.error_sessions ?? 0),
    reports: Number(row?.reports ?? 0),
    devices: Number(row?.devices ?? 0),
    bytes: Number(row?.bytes ?? 0),
    duration_ms: Math.round(Number(row?.duration_ms ?? 0)),
    live_now: Number(row?.live_now ?? 0),
  };
}

/** Sessions per day, with how many saw an error and what they stored. */
export async function dailySessions(db: Db, appId: string, since: Date) {
  const result = await sql<{
    day: string;
    sessions: string;
    error_sessions: string;
    devices: string;
    bytes: string;
  }>`
    SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day,
           count(*) AS sessions,
           count(*) FILTER (WHERE error_count > 0) AS error_sessions,
           count(DISTINCT device_id) AS devices,
           coalesce(sum(size_bytes), 0) AS bytes
      FROM recording_sessions
     WHERE app_id = ${appId} AND started_at >= ${since} AND ${STORED}
     GROUP BY 1
     ORDER BY 1
  `.execute(db);
  return result.rows.map((row) => ({
    day: row.day,
    sessions: Number(row.sessions),
    error_sessions: Number(row.error_sessions),
    devices: Number(row.devices),
    bytes: Number(row.bytes),
  }));
}

/** What started the sessions in the window: an error, a shake, the app, a rule. */
export async function sessionStarts(db: Db, appId: string, since: Date) {
  const result = await sql<{ start: string; sessions: string }>`
    SELECT start, count(*) AS sessions
      FROM recording_sessions
     WHERE app_id = ${appId} AND started_at >= ${since} AND ${STORED}
     GROUP BY 1
     ORDER BY 2 DESC
  `.execute(db);
  return result.rows.map((row) => ({ start: row.start, sessions: Number(row.sessions) }));
}

/**
 * Sessions and error sessions per app version, highest version first: how each release behaves on
 * the devices that run it.
 */
export async function versionQuality(db: Db, appId: string, since: Date, limit = 8) {
  const result = await sql<{
    version: string;
    sessions: string;
    error_sessions: string;
    devices: string;
    last_seen: Date;
  }>`
    SELECT version_name AS version,
           count(*) AS sessions,
           count(*) FILTER (WHERE error_count > 0) AS error_sessions,
           count(DISTINCT device_id) AS devices,
           max(started_at) AS last_seen
      FROM recording_sessions
     WHERE app_id = ${appId} AND started_at >= ${since} AND ${STORED}
     GROUP BY 1
  `.execute(db);
  return [...result.rows]
    .sort((a, b) => compareVersions(b.version, a.version))
    .slice(0, limit)
    .map((row) => ({
      version: row.version,
      sessions: Number(row.sessions),
      error_sessions: Number(row.error_sessions),
      devices: Number(row.devices),
      last_seen: new Date(row.last_seen).toISOString(),
    }));
}

export async function issueCounts(db: Db, appId: string, since: Date) {
  const result = await sql<{ open: string; regressed: string; new: string }>`
    SELECT count(*) FILTER (WHERE status = 'open') AS open,
           count(*) FILTER (WHERE status = 'regressed') AS regressed,
           count(*) FILTER (WHERE first_seen >= ${since}) AS new
      FROM recording_issues
     WHERE app_id = ${appId}
  `.execute(db);
  const row = result.rows[0];
  return {
    open: Number(row?.open ?? 0),
    regressed: Number(row?.regressed ?? 0),
    new: Number(row?.new ?? 0),
  };
}

/** The unresolved errors that hit the most sessions in the window. */
export async function topIssues(db: Db, appId: string, since: Date, limit = 5) {
  const result = await sql<{
    id: string;
    message: string;
    frame: string | null;
    status: string;
    last_seen: Date;
    first_seen: Date;
    occurrences: string;
    sessions: string;
    devices: string;
  }>`
    SELECT i.id, i.message, i.frame, i.status, i.last_seen, i.first_seen,
           sum(s.occurrences) AS occurrences,
           count(DISTINCT s.session_id) AS sessions,
           count(DISTINCT s.device_id) AS devices
      FROM recording_issue_sessions s
      JOIN recording_issues i ON i.id = s.issue_id
     WHERE i.app_id = ${appId} AND s.first_at >= ${since} AND i.status <> 'resolved'
     GROUP BY i.id
     ORDER BY count(DISTINCT s.session_id) DESC, sum(s.occurrences) DESC
     LIMIT ${limit}
  `.execute(db);
  return result.rows.map((row) => ({
    id: row.id,
    message: row.message,
    frame: row.frame,
    status: row.status,
    first_seen: new Date(row.first_seen).toISOString(),
    last_seen: new Date(row.last_seen).toISOString(),
    occurrences: Number(row.occurrences),
    sessions: Number(row.sessions),
    devices: Number(row.devices),
  }));
}

/**
 * Recorders that checked in: online now, and online but reporting trouble - an error, or
 * segments dropped for lack of room.
 */
export async function recorderCounts(db: Db, appId: string, onlineSince: Date) {
  const result = await sql<{ total: string; online: string; degraded: string }>`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE seen_at >= ${onlineSince}) AS online,
           count(*) FILTER (
             WHERE seen_at >= ${onlineSince}
               AND (health->>'lastError' IS NOT NULL
                    OR coalesce((health->>'droppedSegments')::numeric, 0) > 0)
           ) AS degraded
      FROM recorder_health
     WHERE app_id = ${appId}
  `.execute(db);
  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0),
    online: Number(row?.online ?? 0),
    degraded: Number(row?.degraded ?? 0),
  };
}

/** Devices a rule currently keeps live. */
export async function liveRuleCount(db: Db, appId: string, now: Date): Promise<number> {
  const result = await sql<{ live: string }>`
    SELECT count(*) AS live
      FROM recording_rules
     WHERE app_id = ${appId} AND live_until > ${now}
  `.execute(db);
  return Number(result.rows[0]?.live ?? 0);
}
