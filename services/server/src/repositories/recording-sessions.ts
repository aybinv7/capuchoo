import { sql } from "kysely";
import type { RecordingSegmentMeta, RecordingSessionMeta } from "@capuchoo/core";
import type { Db } from "../db/database";
import { recordIssueOccurrences } from "./recording-issues";
import type { RecordingSegment, RecordingSession } from "../db/schema";

export interface SessionTarget {
  appId: string;
  deviceUuid: string | null;
  meta: RecordingSessionMeta;
}

/** The session a segment belongs to, created on first sight; the device id is checked by the caller. */
export async function ensureSession(db: Db, target: SessionTarget): Promise<RecordingSession> {
  const { meta } = target;
  const startedAt = new Date(meta.startedAt);
  const inserted = await db
    .insertInto("recording_sessions")
    .values({
      app_id: target.appId,
      session_key: meta.sessionId,
      device_uuid: target.deviceUuid,
      device_id: meta.deviceId,
      platform: meta.platform,
      version_name: meta.versionName.slice(0, 64),
      version_code: meta.versionCode,
      channel: meta.channel,
      start: meta.start,
      mode: meta.mode,
      note: meta.note,
      device: JSON.stringify(meta.device),
      recorder: meta.recorder,
      started_at: startedAt,
      ended_at: startedAt,
    })
    .onConflict((oc) => oc.columns(["app_id", "session_key"]).doNothing())
    .returningAll()
    .executeTakeFirst();
  if (inserted) return inserted;
  const existing = await db
    .selectFrom("recording_sessions")
    .selectAll()
    .where("app_id", "=", target.appId)
    .where("session_key", "=", meta.sessionId)
    .executeTakeFirstOrThrow();
  if (existing.note !== null || !meta.note || existing.device_id !== meta.deviceId) return existing;
  return db
    .updateTable("recording_sessions")
    .set({ note: meta.note })
    .where("id", "=", existing.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export interface StoredSegment {
  sessionId: string;
  meta: RecordingSegmentMeta;
  storageKey: string;
  sizeBytes: number;
  now: Date;
  /** Who recorded it, for counting the segment's errors into their issues. */
  origin: { appId: string; deviceId: string; versionName: string };
}

/** Records a stored segment once; a retried upload of the same `seq` changes nothing. */
export async function recordSegment(db: Db, segment: StoredSegment): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto("recording_segments")
      .values({
        session_id: segment.sessionId,
        seq: segment.meta.seq,
        storage_key: segment.storageKey,
        size_bytes: segment.sizeBytes,
        raw_bytes: segment.meta.bytes,
        events: segment.meta.events,
        errors: segment.meta.errors,
        full_snapshot: segment.meta.fullSnapshot,
        started_at: new Date(segment.meta.startedAt),
        ended_at: new Date(segment.meta.endedAt),
      })
      .onConflict((oc) => oc.columns(["session_id", "seq"]).doNothing())
      .returning("seq")
      .executeTakeFirst();
    if (!inserted) return false;

    await trx
      .updateTable("recording_sessions")
      .set({
        segment_count: sql`segment_count + 1`,
        event_count: sql`event_count + ${segment.meta.events}`,
        size_bytes: sql`size_bytes + ${segment.sizeBytes}`,
        error_count: sql`error_count + ${segment.meta.errors}`,
        ended_at: sql`greatest(ended_at, ${new Date(segment.meta.endedAt)})`,
        finished: sql`finished OR ${segment.meta.final}`,
        last_segment_at: segment.now,
      })
      .where("id", "=", segment.sessionId)
      .execute();

    if (segment.meta.issues?.length) {
      await recordIssueOccurrences(trx, {
        ...segment.origin,
        sessionId: segment.sessionId,
        issues: segment.meta.issues,
      });
    }
    return true;
  });
}

export interface SessionListQuery {
  appId: string;
  deviceUuid?: string | undefined;
  version?: string | undefined;
  withErrors?: boolean | undefined;
  start?: string | undefined;
  /** Cursor: sessions started strictly before this one. */
  before?: { startedAt: Date; id: string } | undefined;
  limit: number;
}

export function listSessions(db: Db, query: SessionListQuery): Promise<RecordingSession[]> {
  let builder = db
    .selectFrom("recording_sessions")
    .selectAll()
    .where("app_id", "=", query.appId)
    .where("segment_count", ">", 0);
  if (query.deviceUuid) builder = builder.where("device_uuid", "=", query.deviceUuid);
  if (query.version) builder = builder.where("version_name", "=", query.version);
  if (query.withErrors) builder = builder.where("error_count", ">", 0);
  if (query.start) builder = builder.where("start", "=", query.start);
  if (query.before) {
    const { startedAt, id } = query.before;
    builder = builder.where((eb) =>
      eb.or([
        eb("started_at", "<", startedAt),
        eb.and([eb("started_at", "=", startedAt), eb("id", "<", id)]),
      ]),
    );
  }
  return builder.orderBy("started_at", "desc").orderBy("id", "desc").limit(query.limit).execute();
}

export function findSession(db: Db, id: string): Promise<RecordingSession | undefined> {
  return db.selectFrom("recording_sessions").selectAll().where("id", "=", id).executeTakeFirst();
}

export function listSegments(db: Db, sessionId: string): Promise<RecordingSegment[]> {
  return db
    .selectFrom("recording_segments")
    .selectAll()
    .where("session_id", "=", sessionId)
    .orderBy("seq")
    .execute();
}

export function findSegment(
  db: Db,
  sessionId: string,
  seq: number,
): Promise<RecordingSegment | undefined> {
  return db
    .selectFrom("recording_segments")
    .selectAll()
    .where("session_id", "=", sessionId)
    .where("seq", "=", seq)
    .executeTakeFirst();
}

/** Deletes the session row and returns the storage keys its segments used. */
export async function deleteSession(db: Db, id: string): Promise<string[]> {
  const keys = await db
    .selectFrom("recording_segments")
    .select("storage_key")
    .where("session_id", "=", id)
    .execute();
  await db.deleteFrom("recording_sessions").where("id", "=", id).execute();
  return keys.map((row) => row.storage_key);
}

/** Removes up to `limit` sessions idle since before `cutoff`; returns their storage keys. */
export async function purgeSessions(db: Db, cutoff: Date, limit: number): Promise<string[]> {
  const stale = await db
    .selectFrom("recording_sessions")
    .select("id")
    .where("last_segment_at", "<", cutoff)
    .limit(limit)
    .execute();
  if (stale.length === 0) return [];
  const ids = stale.map((row) => row.id);
  const keys = await db
    .selectFrom("recording_segments")
    .select("storage_key")
    .where("session_id", "in", ids)
    .execute();
  await db.deleteFrom("recording_sessions").where("id", "in", ids).execute();
  return keys.map((row) => row.storage_key);
}
