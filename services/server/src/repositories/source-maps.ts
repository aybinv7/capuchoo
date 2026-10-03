import { sql } from "kysely";
import type { Db } from "../db/database";

export interface SourceMapWrite {
  appId: string;
  versionName: string;
  path: string;
  storageKey: string;
  sizeBytes: number;
}

/** Stores or replaces a map; returns the storage key it replaced, so its blob can go. */
export async function upsertSourceMap(db: Db, row: SourceMapWrite): Promise<string | null> {
  return db.transaction().execute(async (trx) => {
    const previous = await trx
      .selectFrom("source_maps")
      .select("storage_key")
      .where("app_id", "=", row.appId)
      .where("version_name", "=", row.versionName)
      .where("path", "=", row.path)
      .forUpdate()
      .executeTakeFirst();
    await trx
      .insertInto("source_maps")
      .values({
        app_id: row.appId,
        version_name: row.versionName,
        path: row.path,
        storage_key: row.storageKey,
        size_bytes: row.sizeBytes,
      })
      .onConflict((conflict) =>
        conflict.columns(["app_id", "version_name", "path"]).doUpdateSet({
          storage_key: row.storageKey,
          size_bytes: row.sizeBytes,
        }),
      )
      .execute();
    return previous?.storage_key ?? null;
  });
}

export function listSourceMaps(db: Db, appId: string, versionName: string) {
  return db
    .selectFrom("source_maps")
    .select(["path", "size_bytes", "created_at"])
    .where("app_id", "=", appId)
    .where("version_name", "=", versionName)
    .orderBy("path")
    .execute();
}

export function findSourceMap(db: Db, appId: string, versionName: string, path: string) {
  return db
    .selectFrom("source_maps")
    .select(["storage_key", "size_bytes"])
    .where("app_id", "=", appId)
    .where("version_name", "=", versionName)
    .where("path", "=", path)
    .executeTakeFirst();
}

/**
 * Maps older than `cutoff` that no recording still needs: a stack can only be symbolicated for a
 * version some session ran. Returns the storage keys of the rows removed.
 */
export async function purgeSourceMaps(db: Db, cutoff: Date, limit: number): Promise<string[]> {
  const rows = await db
    .deleteFrom("source_maps")
    .where(
      "id",
      "in",
      db
        .selectFrom("source_maps as map")
        .select("map.id")
        .where("map.created_at", "<", cutoff)
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom("recording_sessions as session")
                .select(sql`1`.as("one"))
                .whereRef("session.app_id", "=", "map.app_id")
                .whereRef("session.version_name", "=", "map.version_name"),
            ),
          ),
        )
        .limit(limit),
    )
    .returning("storage_key")
    .execute();
  return rows.map((row) => row.storage_key);
}
