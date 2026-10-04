import type { CdpSession } from "../cdp/session.ts";
import type { Adb } from "../device/adb.ts";
import { readMemory } from "./memory.ts";
import { readPageMetrics } from "./page.ts";

export interface MemoryPoint {
  /** Seconds since the scenario started. */
  atS: number;
  appPssKb: number | null;
  rendererPssKb: number | null;
  jsHeapUsedKb: number | null;
}

/**
 * Samples memory on an interval while a scenario runs, for its peak and, in a soak, its slope.
 * Samples never overlap: the next one is scheduled only once the previous one is in.
 */
export function startSampling(
  adb: Adb,
  page: CdpSession,
  pids: { app: number; renderer: number | null },
  intervalMs: number,
) {
  const points: MemoryPoint[] = [];
  const started = Date.now();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const sample = async () => {
    const [app, renderer, metrics] = await Promise.all([
      readMemory(adb, pids.app),
      pids.renderer === null ? Promise.resolve(null) : readMemory(adb, pids.renderer),
      readPageMetrics(page).catch(() => null),
    ]);
    points.push({
      atS: Math.round((Date.now() - started) / 100) / 10,
      appPssKb: app?.totalPss ?? null,
      rendererPssKb: renderer?.totalPss ?? null,
      jsHeapUsedKb: metrics ? Math.round(metrics.jsHeapUsed / 1024) : null,
    });
  };
  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      inFlight = sample()
        .catch(() => undefined)
        .finally(schedule);
    }, intervalMs);
  };
  schedule();

  return {
    async stop(): Promise<MemoryPoint[]> {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
      return points;
    },
  };
}
