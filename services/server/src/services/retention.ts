import type { Deps } from "../http/context";
import { expireStaleBuilds, expireStalePipelines } from "../repositories/builds";
import { purgeDeviceEvents } from "../repositories/device-events";
import { purgeExpiredSessions } from "../repositories/sessions";
import { deleteRecorderHealthBefore } from "../repositories/recorder-health";
import { purgeIssues } from "../repositories/recording-issues";
import { purgeOrphanAssets } from "../repositories/recording-assets";
import { purgeSessions as purgeRecordingSessions } from "../repositories/recording-sessions";
import { purgeSourceMaps } from "../repositories/source-maps";

const STALE_BUILD_MS = 2 * 60 * 60 * 1000;
const STALE_PIPELINE_MS = 24 * 60 * 60 * 1000;
const RECORDING_PURGE_BATCH = 200;

/** Old recordings go row and blob together; storage is the expensive half. */
async function purgeRecordings(deps: Deps, cutoff: Date): Promise<number> {
  const sessionKeys = await purgeRecordingSessions(deps.db, cutoff, RECORDING_PURGE_BATCH);
  const assetKeys = await purgeOrphanAssets(deps.db, cutoff, RECORDING_PURGE_BATCH);
  const mapKeys = await purgeSourceMaps(deps.db, cutoff, RECORDING_PURGE_BATCH);
  for (const key of [...sessionKeys, ...assetKeys, ...mapKeys]) {
    await deps.storage
      .delete(key)
      .catch((error: unknown) => deps.logger.warn("recording blob delete failed", { key, error }));
  }
  const health = await deleteRecorderHealthBefore(deps.db, cutoff);
  const issues = await purgeIssues(deps.db, cutoff);
  return sessionKeys.length + assetKeys.length + mapKeys.length + health + issues;
}

/** One pass of housekeeping: expired sessions, old telemetry, builds a crashed CLI never finished. */
export async function runRetention(deps: Deps): Promise<{
  sessions: number;
  events: number;
  builds: number;
  pipelines: number;
  recordings: number;
}> {
  const now = deps.now();
  const cutoff = new Date(now.getTime() - deps.config.DEVICE_EVENT_RETENTION_DAYS * 86_400_000);
  const recordingCutoff = new Date(
    now.getTime() - deps.config.RECORDING_RETENTION_DAYS * 86_400_000,
  );
  const [sessions, events, builds, pipelines, recordings] = await Promise.all([
    purgeExpiredSessions(deps.db, now),
    purgeDeviceEvents(deps.db, cutoff),
    expireStaleBuilds(deps.db, new Date(now.getTime() - STALE_BUILD_MS), now),
    expireStalePipelines(deps.db, new Date(now.getTime() - STALE_PIPELINE_MS), now),
    purgeRecordings(deps, recordingCutoff),
  ]);
  if (sessions || events || builds || pipelines || recordings)
    deps.logger.info("retention pass", { sessions, events, builds, pipelines, recordings });
  return { sessions, events, builds, pipelines, recordings };
}

/** Runs retention hourly; returns a stop function. */
export function scheduleRetention(deps: Deps, intervalMs = 60 * 60 * 1000): () => void {
  const tick = () =>
    void runRetention(deps).catch((error: unknown) =>
      deps.logger.error("retention failed", { error }),
    );
  const first = setTimeout(tick, 30_000);
  const timer = setInterval(tick, intervalMs);
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
