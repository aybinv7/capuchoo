import type { Deps } from "../http/context";
import { expireStaleBuilds, expireStalePipelines } from "../repositories/builds";
import { purgeDeviceEvents } from "../repositories/device-events";
import { purgeExpiredSessions } from "../repositories/sessions";

const STALE_BUILD_MS = 2 * 60 * 60 * 1000;
const STALE_PIPELINE_MS = 24 * 60 * 60 * 1000;

/** One pass of housekeeping: expired sessions, old telemetry, builds a crashed CLI never finished. */
export async function runRetention(
  deps: Deps,
): Promise<{ sessions: number; events: number; builds: number; pipelines: number }> {
  const now = deps.now();
  const cutoff = new Date(now.getTime() - deps.config.DEVICE_EVENT_RETENTION_DAYS * 86_400_000);
  const [sessions, events, builds, pipelines] = await Promise.all([
    purgeExpiredSessions(deps.db, now),
    purgeDeviceEvents(deps.db, cutoff),
    expireStaleBuilds(deps.db, new Date(now.getTime() - STALE_BUILD_MS), now),
    expireStalePipelines(deps.db, new Date(now.getTime() - STALE_PIPELINE_MS), now),
  ]);
  if (sessions || events || builds || pipelines)
    deps.logger.info("retention pass", { sessions, events, builds, pipelines });
  return { sessions, events, builds, pipelines };
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
