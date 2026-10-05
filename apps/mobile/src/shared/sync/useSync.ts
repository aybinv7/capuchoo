import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { clearCatalog, listAppRows } from "@/domains/catalog/catalog.repository";
import { ApiError } from "@/shared/api/http";
import { getDatabase, rdb } from "@/shared/database";
import type { ActivityTable } from "@/shared/database/schema";
import { notifyActivity, trackForeground } from "@/shared/notify/notify";
import { alignCurrentApp, clearCurrentApp, currentAppId } from "@/shared/session/currentApp";
import { api } from "@/shared/api/endpoints";
import { clearSession, session } from "@/shared/session/session";
import { syncInsights } from "./insights";
import { startLive, stopLive } from "./live";
import { refreshInstalled, syncAll } from "./sync";

const syncing = ref(false);
const lastError = ref<string | null>(null);
const lastSyncedAt = ref<string | null>(null);
const signedOut = ref(false);

/** A sync that started within this window is joined rather than repeated. */
const COALESCE_MS = 4_000;

let running: Promise<void> | null = null;
let startedAt = 0;
let liveApps = "";
let resumeListener: PluginListenerHandle | null = null;

async function announce(rows: ActivityTable[]): Promise<void> {
  if (rows.length === 0) return;
  const apps = await listAppRows(getDatabase().db);
  await notifyActivity(rows, new Map(apps.map((app) => [app.id, app])));
}

async function alignLive(): Promise<void> {
  const apps = await listAppRows(getDatabase().db);
  const ids = apps.map((app) => app.id).sort();
  const key = ids.join(",");
  if (key === liveApps) return;
  liveApps = key;
  await startLive(ids, (rows) => void announce(rows));
}

async function run(): Promise<void> {
  syncing.value = true;
  try {
    const outcome = await syncAll();
    lastSyncedAt.value = new Date().toISOString();
    lastError.value = outcome.failed[0]?.message ?? null;
    alignCurrentApp((await listAppRows(getDatabase().db)).map((app) => app.id));
    const appId = currentAppId.value;
    await Promise.all([
      announce(outcome.activity),
      alignLive(),
      appId ? syncInsights(appId) : Promise.resolve(),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      signedOut.value = true;
      await endSession();
      return;
    }
    lastError.value = error instanceof Error ? error.message : String(error);
  } finally {
    syncing.value = false;
  }
}

/** A full sync, or the one already under way. */
function refresh(): Promise<void> {
  if (running && Date.now() - startedAt < COALESCE_MS) return running;
  startedAt = Date.now();
  running = run().finally(() => {
    running = null;
  });
  return running;
}

/**
 * Starts everything a signed-in session keeps up: the first sync, the live streams, and a refresh
 * whenever the app comes back to the foreground - the package manager may have changed underneath
 * it, and the stream may have missed events while the process slept.
 */
export async function startSession(): Promise<void> {
  signedOut.value = false;
  await trackForeground();
  if (Capacitor.isNativePlatform() && !resumeListener) {
    resumeListener = await CapacitorApp.addListener("resume", () => {
      void refreshInstalled().catch(() => undefined);
      void refresh();
    });
  }
  await refresh();
}

/** Stops the streams and forgets everything the phone kept for this account. */
export async function endSession(): Promise<void> {
  await stopLive();
  liveApps = "";
  await resumeListener?.remove();
  resumeListener = null;
  await rdb.transaction().execute((trx) => clearCatalog(trx));
  clearCurrentApp();
  await clearSession();
}

/** Revokes the session on the server, then forgets it here, whatever the server answered. */
export async function signOut(): Promise<void> {
  if (session.value) await api.logout(session.value).catch(() => undefined);
  await endSession();
}

export function useSync() {
  return { syncing, lastError, lastSyncedAt, signedOut, refresh };
}
