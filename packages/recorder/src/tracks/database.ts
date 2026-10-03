import type { DatabaseCaptureState, DatabaseHealth } from "@capuchoo/core";
import type { DatabaseSink, DatabaseSource } from "../database/types.js";
import type { Track, TrackContext } from "../recorder/types.js";

export interface DatabaseTrack extends Track {
  /** Reads each source's starting state into the session that is beginning to upload. */
  snapshot(maxRows: number): void;
  /** Where each source stands, for the recorder's health report. */
  health(): DatabaseHealth[];
}

/** Every registered database, each into the `database` lane under its own name. */
export function createDatabaseTrack(
  sources: readonly DatabaseSource[],
  tables: () => string[] | "all",
): DatabaseTrack {
  let running: Array<{ source: DatabaseSource; sink: DatabaseSink }> = [];
  let ready: Promise<void> = Promise.resolve();
  let snapshotting: AbortController | null = null;
  let context: TrackContext | null = null;
  const states = new Map<DatabaseSource, { state: DatabaseCaptureState; detail: string | null }>();

  function settle(source: DatabaseSource, state: DatabaseCaptureState, detail: string | null) {
    if (running.some((entry) => entry.source === source)) states.set(source, { state, detail });
  }

  function sinkFor(source: DatabaseSource, ctx: TrackContext): DatabaseSink {
    const push = (data: Record<string, unknown>, at?: number) =>
      ctx.push("database", { db: source.name, ...data }, at);
    return {
      changeset: (bytes, at) => push({ kind: "changeset", bytes }, at),
      rows: (changes, at) => push({ kind: "rows", changes }, at),
      change: (change, at) => push({ kind: "change", change }, at),
      schema: (described) => push({ kind: "schema", tables: described }),
      snapshot: (chunk) => push({ kind: "snapshot", ...chunk }),
    };
  }

  async function startOne(source: DatabaseSource, sink: DatabaseSink, ctx: TrackContext) {
    try {
      if (source.ready) {
        try {
          await source.ready();
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          settle(source, "unavailable", reason);
          ctx.push("marker", { kind: "database-unavailable", db: source.name, reason });
          return;
        }
        if (!running.some((entry) => entry.source === source)) return;
      }
      const result = await source.start(sink, tables());
      if (result.supported) {
        settle(source, result.capture ?? "changes", null);
        return;
      }
      settle(source, "unsupported", result.reason);
      ctx.push("marker", { kind: "database-unsupported", db: source.name, reason: result.reason });
    } catch (error) {
      settle(source, "failed", error instanceof Error ? error.message : String(error));
      ctx.logger.warn(`database source ${source.name} failed to start`, error);
    }
  }

  return {
    name: "database",
    start(ctx) {
      if (running.length > 0) return ready;
      context = ctx;
      running = sources.map((source) => ({ source, sink: sinkFor(source, ctx) }));
      for (const source of sources) states.set(source, { state: "waiting", detail: null });
      ready = Promise.all(running.map(({ source, sink }) => startOne(source, sink, ctx))).then(
        () => undefined,
      );
      return ready;
    },
    snapshot(maxRows) {
      snapshotting?.abort();
      if (running.length === 0) return;
      const controller = new AbortController();
      snapshotting = controller;
      const current = running;
      const ctx = context;
      void ready.then(async () => {
        for (const { source, sink } of current) {
          if (controller.signal.aborted) return;
          try {
            await source.snapshot?.(sink, maxRows, controller.signal);
          } catch (error) {
            ctx?.logger.warn(`database source ${source.name} snapshot failed`, error);
          }
        }
      });
    },
    health() {
      return sources.map((source) => {
        const known = running.length > 0 ? states.get(source) : undefined;
        return { name: source.name, state: known?.state ?? "off", detail: known?.detail ?? null };
      });
    },
    stop() {
      snapshotting?.abort();
      snapshotting = null;
      const stopping = running;
      running = [];
      context = null;
      states.clear();
      for (const { source } of stopping) {
        void Promise.resolve(source.stop()).catch(() => undefined);
      }
    },
  };
}
