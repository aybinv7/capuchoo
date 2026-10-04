import type { RunRecord } from "../results.ts";
import { quantile, slope } from "./stats.ts";

export interface Metric {
  key: string;
  label: string;
  unit: string;
  /** Lower is better for every metric here; the report says so rather than guessing per row. */
  read: (run: RunRecord) => number | null;
}

const kbToMb = (kb: number | null | undefined) => (kb == null ? null : kb / 1024);
const perMinute = (value: number | null, run: RunRecord) =>
  value === null || run.durationS <= 0 ? null : (value / run.durationS) * 60;
const peak = (run: RunRecord, key: "appPssKb" | "rendererPssKb") => {
  const values = run.memory.series
    .map((point) => point[key])
    .filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
};
const totalEnd = (run: RunRecord) => {
  const app = run.memory.end.app?.totalPss;
  const renderer = run.memory.end.renderer?.totalPss;
  return app == null || renderer == null ? null : app + renderer;
};

export const METRICS: Metric[] = [
  {
    key: "launch",
    label: "Cold start (am start TotalTime)",
    unit: "ms",
    read: (run) => run.launch.totalTimeMs,
  },
  { key: "ready", label: "First screen ready", unit: "ms", read: (run) => run.readyMs },
  {
    key: "pss-total-end",
    label: "Memory at end, app + WebView (PSS)",
    unit: "MB",
    read: (run) => kbToMb(totalEnd(run)),
  },
  {
    key: "pss-renderer-end",
    label: "WebView renderer at end (PSS)",
    unit: "MB",
    read: (run) => kbToMb(run.memory.end.renderer?.totalPss),
  },
  {
    key: "pss-renderer-peak",
    label: "WebView renderer peak (PSS)",
    unit: "MB",
    read: (run) => kbToMb(peak(run, "rendererPssKb")),
  },
  {
    key: "pss-app-end",
    label: "App process at end (PSS)",
    unit: "MB",
    read: (run) => kbToMb(run.memory.end.app?.totalPss),
  },
  {
    key: "js-heap-end",
    label: "JS heap used at end",
    unit: "MB",
    read: (run) => (run.page.after ? run.page.after.jsHeapUsed / 1_048_576 : null),
  },
  {
    key: "cpu-total",
    label: "CPU time, app + WebView, per minute",
    unit: "ms/min",
    read: (run) =>
      run.cpuMs.app === null || run.cpuMs.renderer === null
        ? null
        : perMinute(run.cpuMs.app + run.cpuMs.renderer, run),
  },
  {
    key: "main-thread",
    label: "Main thread busy, per minute",
    unit: "ms/min",
    read: (run) =>
      run.page.before && run.page.after
        ? perMinute((run.page.after.taskDuration - run.page.before.taskDuration) * 1000, run)
        : null,
  },
  {
    key: "long-tasks",
    label: "Long tasks, total",
    unit: "ms",
    read: (run) => run.page.observations?.longTaskMs ?? null,
  },
  {
    key: "inp-p95",
    label: "Tap to next paint, p95",
    unit: "ms",
    read: (run) => {
      const values = [...(run.page.observations?.interactions ?? [])].sort((a, b) => a - b);
      return values.length ? quantile(values, 0.95) : null;
    },
  },
  {
    key: "slow-frames",
    label: "Slow frames (> 25 ms)",
    unit: "%",
    read: (run) => {
      const observed = run.page.observations;
      return observed && observed.frames > 0 ? (observed.slowFrames / observed.frames) * 100 : null;
    },
  },
  {
    key: "frozen-frames",
    label: "Frozen frames (> 50 ms)",
    unit: "count",
    read: (run) => run.page.observations?.frozenFrames ?? null,
  },
  {
    key: "storage",
    label: "Storage used at end",
    unit: "MB",
    read: (run) => (run.storageBytes.after === null ? null : run.storageBytes.after / 1_048_576),
  },
  {
    key: "renderer-growth",
    label: "WebView memory growth",
    unit: "MB/min",
    read: (run) => {
      const points = run.memory.series
        .filter((point) => point.rendererPssKb !== null)
        .map((point) => [point.atS / 60, point.rendererPssKb! / 1024] as const);
      return slope(points);
    },
  },
];
