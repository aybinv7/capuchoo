import type { Track } from "../recorder/types.js";

const MEMORY_INTERVAL_MS = 10_000;
const INTERACTION_THRESHOLD_MS = 104;

interface ChromeMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function observe(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
  extra: Record<string, unknown> = {},
): PerformanceObserver | null {
  if (typeof PerformanceObserver !== "function") return null;
  if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return null;
  try {
    const observer = new PerformanceObserver((list) => callback(list.getEntries()));
    observer.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
    return observer;
  } catch {
    return null;
  }
}

/** What the WebView itself can see: long tasks, slow interactions, paint, layout shift and heap. */
export function createPerfTrack(): Track {
  let observers: PerformanceObserver[] = [];
  let memoryTimer: ReturnType<typeof setInterval> | null = null;
  const reported = new Set<number>();

  return {
    name: "perf",
    start(ctx) {
      if (memoryTimer !== null) return;
      const origin = performance.timeOrigin;
      const at = (entry: PerformanceEntry) => Math.round(origin + entry.startTime);

      observers = [
        observe("longtask", (entries) => {
          for (const entry of entries) {
            ctx.push("perf", { kind: "longtask", duration: Math.round(entry.duration) }, at(entry));
          }
        }),
        observe(
          "event",
          (entries) => {
            const slowest = new Map<number, PerformanceEventTiming>();
            for (const entry of entries as Array<
              PerformanceEventTiming & { interactionId?: number }
            >) {
              const id = entry.interactionId ?? 0;
              if (id === 0 || reported.has(id)) continue;
              const current = slowest.get(id);
              if (!current || entry.duration > current.duration) slowest.set(id, entry);
            }
            for (const [id, entry] of slowest) {
              reported.add(id);
              if (reported.size > 500) reported.delete(reported.values().next().value!);
              ctx.push(
                "perf",
                {
                  kind: "interaction",
                  name: entry.name,
                  duration: Math.round(entry.duration),
                  delay: Math.round(entry.processingStart - entry.startTime),
                },
                at(entry),
              );
            }
          },
          { durationThreshold: INTERACTION_THRESHOLD_MS },
        ),
        observe("largest-contentful-paint", (entries) => {
          const last = entries.at(-1);
          if (last) ctx.push("perf", { kind: "lcp", value: Math.round(last.startTime) }, at(last));
        }),
        observe("layout-shift", (entries) => {
          for (const entry of entries as Array<
            PerformanceEntry & { value: number; hadRecentInput: boolean }
          >) {
            if (!entry.hadRecentInput && entry.value > 0.01) {
              ctx.push(
                "perf",
                { kind: "layout-shift", value: Number(entry.value.toFixed(4)) },
                at(entry),
              );
            }
          }
        }),
      ].filter((observer): observer is PerformanceObserver => observer !== null);

      const sample = () => {
        const memory = (performance as Performance & { memory?: ChromeMemory }).memory;
        if (!memory) return;
        ctx.push("perf", {
          kind: "memory",
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        });
      };
      sample();
      memoryTimer = setInterval(sample, MEMORY_INTERVAL_MS);
    },
    stop() {
      for (const observer of observers) observer.disconnect();
      observers = [];
      if (memoryTimer !== null) clearInterval(memoryTimer);
      memoryTimer = null;
    },
  };
}
