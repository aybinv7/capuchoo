import { replaceDevices, saveStats } from "@/domains/insights/insights.repository";
import { api } from "@/shared/api/endpoints";
import { rdb } from "@/shared/database";
import { credentials } from "@/shared/session/session";
import { toDevices } from "./mappers";

/** The windows the dashboard offers, as the web dashboard does. */
export const STAT_WINDOWS = [7, 30, 90] as const;
export type StatWindow = (typeof STAT_WINDOWS)[number];
export const DEFAULT_WINDOW: StatWindow = 30;

const inFlight = new Map<string, Promise<void>>();

/**
 * The server's statistics for one window, kept for the next time the phone is offline. Several
 * tabs ask at once on start; they share the one request.
 */
export function syncStats(appId: string, days: StatWindow): Promise<void> {
  const key = `${appId}:${days}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = (async () => {
    const stats = await api.stats(credentials(), appId, days);
    await saveStats(rdb, {
      app_id: appId,
      days,
      payload: JSON.stringify(stats),
      synced_at: new Date().toISOString(),
    });
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Returns how many devices the server has, which may be more than the phone lists. */
export async function syncDevices(appId: string): Promise<number> {
  const page = await api.devices(credentials(), appId);
  const rows = toDevices(page.devices);
  await rdb.transaction().execute((trx) => replaceDevices(trx, appId, rows));
  return page.total;
}

/** Statistics and devices for the app on screen; one failing does not keep the other. */
export async function syncInsights(
  appId: string,
  days: StatWindow = DEFAULT_WINDOW,
): Promise<{ failure: unknown }> {
  const results = await Promise.allSettled([syncStats(appId, days), syncDevices(appId)]);
  const rejected = results.find((result) => result.status === "rejected");
  return { failure: rejected?.reason };
}
