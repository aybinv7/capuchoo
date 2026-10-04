import type { Track } from "../recorder/types.js";
import { callerFrames, describeArgs, stackOf } from "./describe.js";

const LEVELS = ["log", "info", "warn", "error", "debug"] as const;
type Level = (typeof LEVELS)[number];

export interface ConsoleEntry {
  level: Level;
  text: string;
  stack: string | null;
  /**
   * Where an error was logged, for a `console.error` whose arguments carry no stack (a native
   * plugin's rejection, a string): the app frames that called it.
   */
  site?: string | null;
  source: "console" | "uncaught" | "rejection";
}

/**
 * Console output and uncaught errors. Each patched method calls the original first, so the app's own
 * logging and devtools behave exactly as before.
 */
export function createConsoleTrack(onError: (entry: ConsoleEntry) => void): Track {
  const originals = new Map<Level, (...args: unknown[]) => void>();
  let detach: (() => void) | null = null;

  return {
    name: "console",
    start(ctx) {
      if (detach) return;
      const emit = (entry: ConsoleEntry) => {
        ctx.push("console", entry);
        if (entry.level === "error") onError(entry);
      };

      for (const level of LEVELS) {
        const original = console[level] as (...args: unknown[]) => void;
        originals.set(level, original);
        console[level] = (...args: unknown[]) => {
          original.apply(console, args);
          try {
            const stack = level === "error" ? (args.map(stackOf).find(Boolean) ?? null) : null;
            const site =
              level === "error" && !stack ? callerFrames(new Error("site").stack, 1) : null;
            emit({
              level,
              text: describeArgs(args),
              stack,
              ...(site ? { site } : {}),
              source: "console",
            });
          } catch {
            return;
          }
        };
      }

      const onUncaught = (event: ErrorEvent) => {
        const message = event.message || describeArgs([event.error]);
        emit({
          level: "error",
          text: message.startsWith("Uncaught ") ? message : `Uncaught ${message}`,
          stack:
            stackOf(event.error) ??
            (event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : null),
          source: "uncaught",
        });
      };
      const onRejection = (event: PromiseRejectionEvent) => {
        emit({
          level: "error",
          text: `Unhandled rejection ${describeArgs([event.reason])}`,
          stack: stackOf(event.reason),
          source: "rejection",
        });
      };
      window.addEventListener("error", onUncaught);
      window.addEventListener("unhandledrejection", onRejection);

      detach = () => {
        for (const [level, original] of originals) console[level] = original;
        originals.clear();
        window.removeEventListener("error", onUncaught);
        window.removeEventListener("unhandledrejection", onRejection);
      };
    },
    stop() {
      detach?.();
      detach = null;
    },
  };
}
