import type { Kysely, Selectable, Transaction } from "kysely";
import type {
  AccountTable,
  AppIdentifierTable,
  AppTable,
  BundleTable,
  ChannelTable,
  Database,
  InstalledTable,
  NativeBuildTable,
  OrganizationTable,
} from "@/shared/database/schema";

type Db = Kysely<Database> | Transaction<Database>;

export type Account = Selectable<AccountTable>;
export type Organization = Selectable<OrganizationTable>;
export type App = Selectable<AppTable>;
export type Channel = Selectable<ChannelTable>;
export type NativeBuild = Selectable<NativeBuildTable>;
export type Bundle = Selectable<BundleTable>;
export type Identifier = Selectable<AppIdentifierTable>;
export type Installed = Selectable<InstalledTable>;

/** SQLite caps bound parameters per statement; ~150 rows of a wide table stays well inside it. */
const CHUNK = 50;

function chunks<T>(rows: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) out.push(rows.slice(index, index + size));
  return out;
}

export async function replaceAccount(
  db: Db,
  account: AccountTable,
  organizations: OrganizationTable[],
): Promise<void> {
  await db.deleteFrom("account").execute();
  await db.insertInto("account").values(account).execute();
  await db.deleteFrom("organization").execute();
  for (const rows of chunks(organizations)) await db.insertInto("organization").values(rows).execute();
}

/**
 * The apps this account reaches now. An app it lost access to goes with its channels and builds,
 * so nothing it may no longer see lingers on the phone. `notify` is the phone's own choice and
 * survives the refresh.
 */
export async function replaceApps(db: Db, apps: Omit<AppTable, "notify" | "synced_at">[]): Promise<void> {
  const ids = apps.map((app) => app.id);
  const gone = db.selectFrom("app").select("id").where("id", "not in", ids.length ? ids : [""]);
  for (const table of ["channel", "native_build", "bundle", "app_identifier", "installed", "activity"] as const)
    await db.deleteFrom(table).where("app_id", "in", gone).execute();
  await db.deleteFrom("app").where("id", "not in", ids.length ? ids : [""]).execute();

  for (const rows of chunks(apps))
    await db
      .insertInto("app")
      .values(rows.map((row) => ({ ...row, notify: 1, synced_at: null })))
      .onConflict((oc) =>
        oc.column("id").doUpdateSet((eb) => ({
          bundle_id: eb.ref("excluded.bundle_id"),
          name: eb.ref("excluded.name"),
          organization_id: eb.ref("excluded.organization_id"),
          platform: eb.ref("excluded.platform"),
          role: eb.ref("excluded.role"),
          prod_role: eb.ref("excluded.prod_role"),
          icon_url: eb.ref("excluded.icon_url"),
          channel_count: eb.ref("excluded.channel_count"),
          device_count: eb.ref("excluded.device_count"),
          native_count: eb.ref("excluded.native_count"),
          bundle_count: eb.ref("excluded.bundle_count"),
        })),
      )
      .execute();
}

export interface AppDetail {
  identifiers: AppIdentifierTable[];
  channels: ChannelTable[];
  natives: NativeBuildTable[];
  bundles: BundleTable[];
}

/** One app's channels and builds as the server has them now, in one transaction by the caller. */
export async function replaceAppDetail(db: Db, appId: string, detail: AppDetail, syncedAt: string): Promise<void> {
  for (const table of ["app_identifier", "channel", "native_build", "bundle"] as const)
    await db.deleteFrom(table).where("app_id", "=", appId).execute();
  for (const rows of chunks(detail.identifiers)) await db.insertInto("app_identifier").values(rows).execute();
  for (const rows of chunks(detail.channels)) await db.insertInto("channel").values(rows).execute();
  for (const rows of chunks(detail.natives)) await db.insertInto("native_build").values(rows).execute();
  for (const rows of chunks(detail.bundles)) await db.insertInto("bundle").values(rows).execute();
  await db.updateTable("app").set({ synced_at: syncedAt }).where("id", "=", appId).execute();
}

export async function setAppNotify(db: Db, appId: string, notify: boolean): Promise<void> {
  await db.updateTable("app").set({ notify: notify ? 1 : 0 }).where("id", "=", appId).execute();
}

export async function replaceInstalled(db: Db, rows: InstalledTable[]): Promise<void> {
  for (const batch of chunks(rows))
    await db
      .insertInto("installed")
      .values(batch)
      .onConflict((oc) =>
        oc.column("bundle_id").doUpdateSet((eb) => ({
          app_id: eb.ref("excluded.app_id"),
          installed: eb.ref("excluded.installed"),
          version_name: eb.ref("excluded.version_name"),
          version_code: eb.ref("excluded.version_code"),
          updated_at: eb.ref("excluded.updated_at"),
          checked_at: eb.ref("excluded.checked_at"),
        })),
      )
      .execute();
}

export async function clearCatalog(db: Db): Promise<void> {
  for (const table of [
    "activity",
    "installed",
    "bundle",
    "native_build",
    "channel",
    "app_identifier",
    "app",
    "organization",
    "account",
  ] as const)
    await db.deleteFrom(table).execute();
}

export function getAccount(db: Db): Promise<Account | undefined> {
  return db.selectFrom("account").selectAll().executeTakeFirst();
}

export function listOrganizations(db: Db): Promise<Organization[]> {
  return db.selectFrom("organization").selectAll().orderBy("name").execute();
}

export function listAppRows(db: Db): Promise<App[]> {
  return db.selectFrom("app").selectAll().orderBy("name").execute();
}

export function getApp(db: Db, appId: string): Promise<App | undefined> {
  return db.selectFrom("app").selectAll().where("id", "=", appId).executeTakeFirst();
}

export function listChannels(db: Db, appId?: string): Promise<Channel[]> {
  let query = db.selectFrom("channel").selectAll();
  if (appId) query = query.where("app_id", "=", appId);
  return query.orderBy("name").execute();
}

export function listNatives(db: Db, appId?: string): Promise<NativeBuild[]> {
  let query = db.selectFrom("native_build").selectAll();
  if (appId) query = query.where("app_id", "=", appId);
  return query.orderBy("version_code", "desc").execute();
}

export function getNative(db: Db, nativeId: string): Promise<NativeBuild | undefined> {
  return db.selectFrom("native_build").selectAll().where("id", "=", nativeId).executeTakeFirst();
}

export function listBundles(db: Db, appId: string): Promise<Bundle[]> {
  return db.selectFrom("bundle").selectAll().where("app_id", "=", appId).orderBy("created_at", "desc").execute();
}

export function listIdentifiers(db: Db, appId?: string): Promise<Identifier[]> {
  let query = db.selectFrom("app_identifier").selectAll();
  if (appId) query = query.where("app_id", "=", appId);
  return query.execute();
}

export function listInstalled(db: Db, appId?: string): Promise<Installed[]> {
  let query = db.selectFrom("installed").selectAll();
  if (appId) query = query.where("app_id", "=", appId);
  return query.execute();
}
