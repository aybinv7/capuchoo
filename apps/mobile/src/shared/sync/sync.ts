import { api } from "@/shared/api/endpoints";
import { recordActivity } from "@/domains/activity/activity.repository";
import {
  listAppRows,
  listChannels,
  listIdentifiers,
  listNatives,
  replaceAccount,
  replaceAppDetail,
  replaceApps,
  replaceInstalled,
} from "@/domains/catalog/catalog.repository";
import { getDatabase, rdb } from "@/shared/database";
import type { ActivityTable, InstalledTable } from "@/shared/database/schema";
import { CapuchooDevice, hasDevice } from "@/shared/native/device";
import { credentials } from "@/shared/session/session";
import { diffActivity, type Snapshot } from "./activity-diff";
import {
  toAccount,
  toApps,
  toBundles,
  toChannels,
  toIdentifiers,
  toNatives,
  toOrganizations,
} from "./mappers";

/** Apps synced at once: enough to hide latency, few enough not to queue behind each other. */
const PARALLEL = 3;

async function snapshotOf(appId: string): Promise<Snapshot | null> {
  const db = getDatabase().db;
  const [channels, natives] = await Promise.all([listChannels(db, appId), listNatives(db, appId)]);
  return channels.length === 0 && natives.length === 0 ? null : { channels, natives };
}

/**
 * One app's channels, builds and identifiers, written in one transaction, and what changed since
 * the last time recorded as activity. Returns that activity, so the caller can notify about it.
 */
export async function syncApp(appId: string): Promise<ActivityTable[]> {
  const c = credentials();
  const [identifiers, channels, artefacts] = await Promise.all([
    api.identifiers(c, appId).catch(() => []),
    api.channels(c, appId),
    api.artefacts(c, appId),
  ]);
  const at = new Date().toISOString();
  const app = (await listAppRows(getDatabase().db)).find((row) => row.id === appId);
  const detail = {
    identifiers: toIdentifiers(appId, identifiers, app?.bundle_id ?? ""),
    channels: toChannels(appId, channels, at),
    natives: toNatives(appId, artefacts.natives),
    bundles: toBundles(appId, artefacts.bundles),
  };

  const previous = await snapshotOf(appId);
  const activity = diffActivity(appId, previous, detail, at);

  await rdb.transaction().execute(async (trx) => {
    await replaceAppDetail(trx, appId, detail, at);
    if (activity.length > 0) await recordActivity(trx, activity);
  });
  return previous ? activity : [];
}

export interface SyncOutcome {
  activity: ActivityTable[];
  failed: Array<{ appId: string; message: string }>;
}

/** The account, every app it reaches, and then each app's detail, a few at a time. */
export async function syncAll(): Promise<SyncOutcome> {
  const c = credentials();
  const [me, apps] = await Promise.all([api.me(c), api.apps(c)]);
  const at = new Date().toISOString();

  await rdb.transaction().execute(async (trx) => {
    await replaceAccount(trx, toAccount(me, c.endpoint, at), toOrganizations(me));
    await replaceApps(trx, toApps(apps));
  });

  const outcome: SyncOutcome = { activity: [], failed: [] };
  const queue = toApps(apps).map((app) => app.id);
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let appId = queue.shift(); appId; appId = queue.shift()) {
        try {
          outcome.activity.push(...(await syncApp(appId)));
        } catch (error) {
          outcome.failed.push({
            appId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }),
  );

  await refreshInstalled();
  return outcome;
}

/** Asks the package manager about every identifier the synced apps install under. */
export async function refreshInstalled(): Promise<void> {
  if (!hasDevice()) return;
  const identifiers = await listIdentifiers(getDatabase().db);
  if (identifiers.length === 0) return;

  const { packages } = await CapuchooDevice.packages({
    packageNames: [...new Set(identifiers.map((row) => row.bundle_id))],
  });
  const appOf = new Map(identifiers.map((row) => [row.bundle_id, row.app_id]));
  const at = new Date().toISOString();
  const rows: InstalledTable[] = packages.map((pkg) => ({
    bundle_id: pkg.packageName,
    app_id: appOf.get(pkg.packageName) ?? "",
    installed: pkg.installed ? 1 : 0,
    version_name: pkg.versionName ?? null,
    version_code: pkg.versionCode ?? null,
    updated_at: pkg.lastUpdateTime ? new Date(pkg.lastUpdateTime).toISOString() : null,
    checked_at: at,
  }));
  await replaceInstalled(rdb, rows);
}
