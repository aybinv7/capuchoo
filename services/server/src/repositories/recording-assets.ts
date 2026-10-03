import type { Db } from "../db/database";
import type { RecordingAsset } from "../db/schema";

export function listAssets(db: Db, appId: string, versionName: string): Promise<RecordingAsset[]> {
  return db
    .selectFrom("recording_assets")
    .selectAll()
    .where("app_id", "=", appId)
    .where("version_name", "=", versionName)
    .orderBy("path")
    .execute();
}

export async function hasAsset(
  db: Db,
  appId: string,
  versionName: string,
  path: string,
): Promise<boolean> {
  const row = await db
    .selectFrom("recording_assets")
    .select("id")
    .where("app_id", "=", appId)
    .where("version_name", "=", versionName)
    .where("path", "=", path)
    .executeTakeFirst();
  return row !== undefined;
}

export function findAsset(db: Db, id: string): Promise<RecordingAsset | undefined> {
  return db.selectFrom("recording_assets").selectAll().where("id", "=", id).executeTakeFirst();
}

export interface NewAsset {
  appId: string;
  versionName: string;
  path: string;
  sha256: string;
  contentType: string;
  storageKey: string;
  sizeBytes: number;
}

/** Stores an asset once per app, version and path; the first upload wins. */
export async function insertAsset(db: Db, asset: NewAsset): Promise<boolean> {
  const inserted = await db
    .insertInto("recording_assets")
    .values({
      app_id: asset.appId,
      version_name: asset.versionName,
      path: asset.path,
      sha256: asset.sha256,
      content_type: asset.contentType,
      storage_key: asset.storageKey,
      size_bytes: asset.sizeBytes,
    })
    .onConflict((oc) => oc.columns(["app_id", "version_name", "path"]).doNothing())
    .returning("id")
    .executeTakeFirst();
  return inserted !== undefined;
}

/** Assets of versions no remaining session refers to, older than `cutoff`; returns their storage keys. */
export async function purgeOrphanAssets(db: Db, cutoff: Date, limit: number): Promise<string[]> {
  const orphans = await db
    .selectFrom("recording_assets as asset")
    .select(["asset.id", "asset.storage_key"])
    .where("asset.created_at", "<", cutoff)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("recording_sessions as session")
            .select("session.id")
            .whereRef("session.app_id", "=", "asset.app_id")
            .whereRef("session.version_name", "=", "asset.version_name"),
        ),
      ),
    )
    .limit(limit)
    .execute();
  if (orphans.length === 0) return [];
  await db
    .deleteFrom("recording_assets")
    .where(
      "id",
      "in",
      orphans.map((row) => row.id),
    )
    .execute();
  return orphans.map((row) => row.storage_key);
}
