import type { CdpSession } from "../cdp/session.ts";

/** What the page itself saw during a scenario: blocked main thread, slow taps and dropped frames. */
export interface PageObservations {
  longTasks: number;
  longTaskMs: number;
  maxLongTaskMs: number;
  /** Interaction latencies (tap to next paint), in ms, from the Event Timing API. */
  interactions: number[];
  frames: number;
  /** Frames that took longer than 1.5 refreshes at 60 Hz, and longer than 50 ms. */
  slowFrames: number;
  frozenFrames: number;
  maxFrameGapMs: number;
}

/**
 * Installed once per page; `reset` starts a new window. Counts are kept as running totals rather
 * than lists, so a twenty-minute soak costs the page the same as a ten-second scenario.
 */
const OBSERVER = `(() => {
  if (window.__benchObserver) { window.__benchObserver.reset(); return true; }
  const state = {};
  const reset = () => Object.assign(state, {
    longTasks: 0, longTaskMs: 0, maxLongTaskMs: 0, interactions: [],
    frames: 0, slowFrames: 0, frozenFrames: 0, maxFrameGapMs: 0, last: 0,
  });
  reset();
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks += 1;
        state.longTaskMs += entry.duration;
        state.maxLongTaskMs = Math.max(state.maxLongTaskMs, entry.duration);
      }
    }).observe({ type: "longtask" });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.interactionId && state.interactions.length < 5000) state.interactions.push(entry.duration);
      }
    }).observe({ type: "event", durationThreshold: 16 });
  } catch {}
  const tick = (now) => {
    if (state.last) {
      const gap = now - state.last;
      state.frames += 1;
      if (gap > 25) state.slowFrames += 1;
      if (gap > 50) state.frozenFrames += 1;
      if (gap > state.maxFrameGapMs) state.maxFrameGapMs = gap;
    }
    state.last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__benchObserver = {
    reset,
    read: () => ({
      longTasks: state.longTasks, longTaskMs: state.longTaskMs, maxLongTaskMs: state.maxLongTaskMs,
      interactions: state.interactions.slice(), frames: state.frames, slowFrames: state.slowFrames,
      frozenFrames: state.frozenFrames, maxFrameGapMs: state.maxFrameGapMs,
    }),
  };
  return true;
})()`;

export async function startObserving(page: CdpSession): Promise<void> {
  await page.evaluate(OBSERVER);
}

export async function readObservations(page: CdpSession): Promise<PageObservations | null> {
  return page.evaluate<PageObservations | null>(
    "window.__benchObserver ? window.__benchObserver.read() : null",
  );
}

/** Chromium's own counters for the page; durations are cumulative seconds since the page loaded. */
export interface PageMetrics {
  jsHeapUsed: number;
  jsHeapTotal: number;
  nodes: number;
  listeners: number;
  taskDuration: number;
  scriptDuration: number;
  layoutDuration: number;
  recalcStyleDuration: number;
}

export async function readPageMetrics(page: CdpSession): Promise<PageMetrics> {
  const { metrics } = await page.send<{ metrics: Array<{ name: string; value: number }> }>(
    "Performance.getMetrics",
  );
  const value = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0;
  return {
    jsHeapUsed: value("JSHeapUsedSize"),
    jsHeapTotal: value("JSHeapTotalSize"),
    nodes: value("Nodes"),
    listeners: value("JSEventListeners"),
    taskDuration: value("TaskDuration"),
    scriptDuration: value("ScriptDuration"),
    layoutDuration: value("LayoutDuration"),
    recalcStyleDuration: value("RecalcStyleDuration"),
  };
}

/** What the app said about itself through the testbed's bench hooks. */
export interface AppProbe {
  arm: string | null;
  readyMs: number | null;
  recorderMode: string | null;
  storageBytes: number | null;
}

export async function readAppProbe(page: CdpSession): Promise<AppProbe> {
  return page.evaluate<AppProbe>(`(async () => {
    const bench = window.__capuchooBench;
    let storageBytes = null;
    try { storageBytes = (await navigator.storage.estimate()).usage ?? null; } catch {}
    let recorderMode = null;
    try { recorderMode = bench ? bench.recorderMode() : null; } catch {}
    return { arm: bench ? bench.arm : null, readyMs: bench ? bench.readyAt : null, recorderMode, storageBytes };
  })()`);
}
