import type { Db } from "../db/database";
import type { Bundle, NativeBuild, NewBundle, NewNativeBuild } from "../db/schema";

export function insertBundle(db: Db, row: NewBundle): Promise<Bundle> {
  return db.insertInto("bundles").values(row).returningAll().executeTakeFirstOrThrow();
}

export function insertNativeBuild(db: Db, row: NewNativeBuild): Promise<NativeBuild> {
  return db.insertInto("native_builds").values(row).returningAll().executeTakeFirstOrThrow();
}

export function findBundle(db: Db, id: string): Promise<Bundle | undefined> {
  return db
    .selectFrom("bundles")
    .selectAll()
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

export function findNativeBuild(db: Db, id: string): Promise<NativeBuild | undefined> {
  return db
    .selectFrom("native_builds")
    .selectAll()
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

export function findBundleByVersion(db: Db, appId: string, platform: string, version: string) {
  return db
    .selectFrom("bundles")
    .selectAll()
    .where("app_id", "=", appId)
    .where("platform", "=", platform as Bundle["platform"])
    .where("version_name", "=", version)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

export function findNativeByCode(
  db: Db,
  appId: string,
  platform: string,
  flavour: string,
  versionCode: number,
) {
  return db
    .selectFrom("native_builds")
    .selectAll()
    .where("app_id", "=", appId)
    .where("platform", "=", platform as NativeBuild["platform"])
    .where("flavour", "=", flavour as NativeBuild["flavour"])
    .where("version_code", "=", versionCode)
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

export function listBundles(db: Db, appId: string, limit = 200) {
  return db
    .selectFrom("bundles")
    .leftJoin("users", "users.id", "bundles.uploaded_by")
    .selectAll("bundles")
    .select("users.email as uploaded_by_email")
    .where("bundles.app_id", "=", appId)
    .where("bundles.deleted_at", "is", null)
    .orderBy("bundles.created_at", "desc")
    .limit(limit)
    .execute();
}

export function listNativeBuilds(db: Db, appId: string, limit = 200) {
  return db
    .selectFrom("native_builds")
    .leftJoin("users", "users.id", "native_builds.uploaded_by")
    .selectAll("native_builds")
    .select("users.email as uploaded_by_email")
    .where("native_builds.app_id", "=", appId)
    .where("native_builds.deleted_at", "is", null)
    .orderBy("native_builds.created_at", "desc")
    .limit(limit)
    .execute();
}

/** The certificate of the newest native build for a platform and flavour, for continuity checks. */
export async function latestSigningCert(db: Db, appId: string, platform: string, flavour: string) {
  const row = await db
    .selectFrom("native_builds")
    .select(["signing_cert_sha256", "version_code"])
    .where("app_id", "=", appId)
    .where("platform", "=", platform as NativeBuild["platform"])
    .where("flavour", "=", flavour as NativeBuild["flavour"])
    .where("signing_cert_sha256", "is not", null)
    .where("deleted_at", "is", null)
    .orderBy("version_code", "desc")
    .limit(1)
    .executeTakeFirst();
  return row ?? null;
}

export async function softDeleteBundle(db: Db, id: string, now: Date): Promise<void> {
  await db.updateTable("bundles").set({ deleted_at: now }).where("id", "=", id).execute();
}

export async function softDeleteNativeBuild(db: Db, id: string, now: Date): Promise<void> {
  await db.updateTable("native_builds").set({ deleted_at: now }).where("id", "=", id).execute();
}

export async function updateBundleMeta(
  db: Db,
  id: string,
  patch: { required?: boolean; release_notes?: string | null },
): Promise<Bundle> {
  return db
    .updateTable("bundles")
    .set(patch)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateNativeMeta(
  db: Db,
  id: string,
  patch: { required?: boolean; release_notes?: string | null },
): Promise<NativeBuild> {
  return db
    .updateTable("native_builds")
    .set(patch)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}
