import type { AppFlavour, AppRole } from "@capuchoo/core";
import { sql } from "kysely";
import type { Db } from "../db/database";
import type { App } from "../db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);

/** An app by uuid, or by its primary bundle id when the reference is not a uuid. */
export function findApp(db: Db, reference: string): Promise<App | undefined> {
  const query = db.selectFrom("apps").selectAll();
  return (
    isUuid(reference) ? query.where("id", "=", reference) : query.where("app_id", "=", reference)
  ).executeTakeFirst();
}

/** An app by any registered bundle identifier, with the flavour that identifier declares. */
export async function findAppByBundleId(
  db: Db,
  bundleId: string,
): Promise<{ app: App; flavour: AppFlavour | null; platform: string } | undefined> {
  const identifier = await db
    .selectFrom("app_identifiers")
    .innerJoin("apps", "apps.id", "app_identifiers.app_id")
    .selectAll("apps")
    .select([
      "app_identifiers.flavour as identifier_flavour",
      "app_identifiers.platform as identifier_platform",
    ])
    .where("app_identifiers.bundle_id", "=", bundleId)
    .executeTakeFirst();
  if (identifier) {
    const { identifier_flavour, identifier_platform, ...app } = identifier;
    return { app, flavour: identifier_flavour, platform: identifier_platform };
  }
  const app = await db
    .selectFrom("apps")
    .selectAll()
    .where("app_id", "=", bundleId)
    .executeTakeFirst();
  return app ? { app, flavour: null, platform: "all" } : undefined;
}

export interface AccessibleApp extends App {
  role: AppRole;
}

/** Apps the user can see, each with the account role on it (org owner/admin count as admin). */
export async function listAccessibleApps(
  db: Db,
  userId: string,
  isInstanceAdmin: boolean,
): Promise<AccessibleApp[]> {
  const rows = await db
    .selectFrom("apps")
    .leftJoin("organization_members as m", (join) =>
      join.onRef("m.organization_id", "=", "apps.organization_id").on("m.user_id", "=", userId),
    )
    .leftJoin("app_permissions as p", (join) =>
      join.onRef("p.app_id", "=", "apps.id").on("p.user_id", "=", userId),
    )
    .selectAll("apps")
    .select(["m.role as org_role", "p.role as app_role"])
    .$if(!isInstanceAdmin, (query) =>
      query.where((eb) =>
        eb.or([eb("m.role", "in", ["owner", "admin"]), eb("p.role", "is not", null)]),
      ),
    )
    .orderBy("apps.name")
    .execute();
  return rows.map(({ org_role, app_role, ...app }) => ({
    ...app,
    role:
      isInstanceAdmin || org_role === "owner" || org_role === "admin"
        ? "admin"
        : (app_role as AppRole),
  }));
}

export async function appRoleFor(db: Db, appId: string, userId: string): Promise<AppRole | null> {
  const row = await db
    .selectFrom("app_permissions")
    .select("role")
    .where("app_id", "=", appId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return row?.role ?? null;
}

export async function createApp(
  db: Db,
  input: { organizationId: string; bundleId: string; name: string; platform: string },
): Promise<App> {
  return db.transaction().execute(async (trx) => {
    const app = await trx
      .insertInto("apps")
      .values({
        organization_id: input.organizationId,
        app_id: input.bundleId,
        name: input.name,
        platform: input.platform,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("app_identifiers")
      .values({ app_id: app.id, bundle_id: input.bundleId, flavour: null, platform: "all" })
      .onConflict((oc) => oc.column("bundle_id").doNothing())
      .execute();
    return app;
  });
}

export async function updateApp(
  db: Db,
  id: string,
  patch: Partial<Pick<App, "name" | "icon_url" | "prod_role" | "public_key" | "require_signature">>,
): Promise<App> {
  return db
    .updateTable("apps")
    .set({ ...patch, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteApp(db: Db, id: string): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("channels")
      .set({ current_bundle_id: null, current_native_id: null })
      .where("app_id", "=", id)
      .execute();
    await trx
      .updateTable("channels")
      .set({ base_channel_id: null, kind: "release" })
      .where("app_id", "=", id)
      .execute();
    await trx.deleteFrom("apps").where("id", "=", id).execute();
  });
}

export function listPermissions(db: Db, appId: string) {
  return db
    .selectFrom("app_permissions as p")
    .innerJoin("users", "users.id", "p.user_id")
    .select(["p.user_id", "p.role", "p.created_at", "users.email", "users.full_name"])
    .where("p.app_id", "=", appId)
    .orderBy("users.email")
    .execute();
}

export async function upsertPermission(
  db: Db,
  appId: string,
  userId: string,
  role: AppRole,
): Promise<void> {
  await db
    .insertInto("app_permissions")
    .values({ app_id: appId, user_id: userId, role })
    .onConflict((oc) => oc.columns(["app_id", "user_id"]).doUpdateSet({ role }))
    .execute();
}

export async function removePermission(db: Db, appId: string, userId: string): Promise<boolean> {
  const result = await db
    .deleteFrom("app_permissions")
    .where("app_id", "=", appId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export function listIdentifiers(db: Db, appId: string) {
  return db
    .selectFrom("app_identifiers")
    .select(["id", "bundle_id", "platform", "flavour", "created_at"])
    .where("app_id", "=", appId)
    .orderBy("created_at")
    .execute();
}

export async function addIdentifier(
  db: Db,
  input: {
    appId: string;
    bundleId: string;
    platform: "android" | "ios" | "all";
    flavour: AppFlavour | null;
  },
) {
  return db
    .insertInto("app_identifiers")
    .values({
      app_id: input.appId,
      bundle_id: input.bundleId,
      platform: input.platform,
      flavour: input.flavour,
    })
    .returning(["id", "bundle_id", "platform", "flavour", "created_at"])
    .executeTakeFirstOrThrow();
}

export async function removeIdentifier(db: Db, appId: string, bundleId: string): Promise<boolean> {
  const result = await db
    .deleteFrom("app_identifiers")
    .where("app_id", "=", appId)
    .where("bundle_id", "=", bundleId)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function identifierOwner(db: Db, bundleId: string): Promise<string | null> {
  const row = await db
    .selectFrom("app_identifiers")
    .select("app_id")
    .where("bundle_id", "=", bundleId)
    .executeTakeFirst();
  return row?.app_id ?? null;
}

export async function appCounts(db: Db, appId: string) {
  const row = await db
    .selectNoFrom([
      sql<string>`(SELECT count(*) FROM channels WHERE app_id = ${appId})`.as("channels"),
      sql<string>`(SELECT count(*) FROM devices WHERE app_id = ${appId})`.as("devices"),
      sql<string>`(SELECT count(*) FROM bundles WHERE app_id = ${appId} AND deleted_at IS NULL)`.as(
        "bundles",
      ),
      sql<string>`(SELECT count(*) FROM native_builds WHERE app_id = ${appId} AND deleted_at IS NULL)`.as(
        "natives",
      ),
    ])
    .executeTakeFirstOrThrow();
  return {
    channels: Number(row.channels),
    devices: Number(row.devices),
    bundles: Number(row.bundles),
    natives: Number(row.natives),
  };
}
