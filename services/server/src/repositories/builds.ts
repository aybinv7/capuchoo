import type { Db } from "../db/database";
import type { Build, BuildEvent, BuildStatus, BuildsTable } from "../db/schema";
import type { Insertable } from "kysely";

export function createBuild(db: Db, row: Insertable<BuildsTable>): Promise<Build> {
  return db.insertInto("builds").values(row).returningAll().executeTakeFirstOrThrow();
}

/** Creates or refreshes a build keyed by an external pipeline id (webhook redelivery is idempotent). */
export async function upsertExternalBuild(
  db: Db,
  row: Insertable<BuildsTable> & { external_id: string },
): Promise<Build> {
  const existing = await db
    .selectFrom("builds")
    .selectAll()
    .where("app_id", "=", row.app_id)
    .where("source", "=", row.source)
    .where("external_id", "=", row.external_id)
    .executeTakeFirst();
  if (!existing) return createBuild(db, row);
  const {
    app_id: _app,
    source: _source,
    external_id: _external,
    created_at: _created,
    id: _id,
    ...patch
  } = row;
  return db
    .updateTable("builds")
    .set(patch)
    .where("id", "=", existing.id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findBuild(db: Db, id: string): Promise<Build | undefined> {
  return db.selectFrom("builds").selectAll().where("id", "=", id).executeTakeFirst();
}

export function addBuildEvent(
  db: Db,
  input: { buildId: string; step: string; status: BuildEvent["status"]; message: string | null },
): Promise<BuildEvent> {
  return db
    .insertInto("build_events")
    .values({
      build_id: input.buildId,
      step: input.step,
      status: input.status,
      message: input.message,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function setBuildStatus(
  db: Db,
  id: string,
  patch: {
    status: BuildStatus;
    error?: string | null;
    bundle_id?: string | null;
    native_id?: string | null;
    started_at?: Date;
    finished_at?: Date;
  },
): Promise<Build> {
  return db
    .updateTable("builds")
    .set(patch)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function listBuilds(db: Db, appId: string, limit: number) {
  return db
    .selectFrom("builds")
    .leftJoin("users", "users.id", "builds.actor_user_id")
    .selectAll("builds")
    .select("users.email as actor_email")
    .where("builds.app_id", "=", appId)
    .orderBy("builds.created_at", "desc")
    .limit(limit)
    .execute();
}

export function listBuildEvents(db: Db, buildId: string) {
  return db
    .selectFrom("build_events")
    .selectAll()
    .where("build_id", "=", buildId)
    .orderBy("id")
    .execute();
}

/** Builds left running by a crashed CLI are closed after the timeout. */
export async function expireStaleBuilds(db: Db, olderThan: Date, now: Date): Promise<number> {
  const result = await db
    .updateTable("builds")
    .set({ status: "failed", error: "No progress reported before the timeout", finished_at: now })
    .where("status", "in", ["queued", "running"])
    .where("source", "=", "cli")
    .where("created_at", "<", olderThan)
    .executeTakeFirst();
  return Number(result.numUpdatedRows);
}
