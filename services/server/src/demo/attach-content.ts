import { sql } from "kysely";
import type { Db } from "../db/database";
import type { StorageDriver } from "../storage/driver";
import { DEMO_SLUG } from "./organization";
import type { ContentPlan } from "./recordings";
import { writeSessionContent } from "./session-content";

/** Blobs of the demo sessions that exist now, so a reseed can drop them once it has committed. */
export async function demoSegmentKeys(db: Db): Promise<string[]> {
  const rows = await db
    .selectFrom("recording_segments as segment")
    .innerJoin("recording_sessions as session", "session.id", "segment.session_id")
    .innerJoin("apps", "apps.id", "session.app_id")
    .innerJoin("organizations", "organizations.id", "apps.organization_id")
    .select("segment.storage_key")
    .where("organizations.slug", "=", DEMO_SLUG)
    .execute();
  return rows.map((row) => row.storage_key);
}

/**
 * Gives each planned session its screen, console and network: the blobs go to storage, then the
 * segment rows and the session's counts follow, so a session lists only once it can play.
 */
export async function attachSessionContent(
  db: Db,
  storage: StorageDriver,
  plans: readonly ContentPlan[],
): Promise<void> {
  for (const plan of plans) {
    const content = await writeSessionContent(storage, plan);
    if (content.segments.length === 0) continue;
    await db
      .insertInto("recording_segments")
      .values(
        content.segments.map((segment) => ({
          session_id: plan.sessionId,
          seq: segment.seq,
          storage_key: segment.storageKey,
          size_bytes: segment.sizeBytes,
          raw_bytes: segment.rawBytes,
          events: segment.events,
          errors: segment.errors,
          full_snapshot: segment.fullSnapshot,
          started_at: segment.startedAt,
          ended_at: segment.endedAt,
        })),
      )
      .execute();
    const endedAt = new Date(plan.startedAt.getTime() + content.durationMs);
    await db
      .updateTable("recording_sessions")
      .set({
        segment_count: content.segments.length,
        event_count: sql`${content.events}`,
        size_bytes: sql`${content.bytes}`,
        error_count: content.errors,
        ended_at: endedAt,
        last_segment_at: endedAt,
      })
      .where("id", "=", plan.sessionId)
      .execute();
  }
}

/** Best effort: a blob that will not go is left to the retention sweep's orphan check. */
export async function dropBlobs(storage: StorageDriver, keys: readonly string[]): Promise<void> {
  for (const key of keys) await storage.delete(key).catch(() => undefined);
}
