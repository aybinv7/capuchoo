import type { DatabaseSink, DatabaseSource } from "../database/types.js";
import type { Track, TrackContext } from "../recorder/types.js";

export interface DatabaseTrack extends Track {
  /** Reads each source's starting state into the session that is beginning to upload. */
  snapshot(maxRows: number): void;
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

  return {
    name: "database",
    start(ctx) {
      if (running.length > 0) return ready;
      context = ctx;
      running = sources.map((source) => ({ source, sink: sinkFor(source, ctx) }));
      ready = Promise.all(
        running.map(async ({ source, sink }) => {
          try {
            const result = await source.start(sink, tables());
            if (!result.supported) {
              ctx.push("marker", {
                kind: "database-unsupported",
                db: source.name,
                reason: result.reason,
              });
            }
          } catch (error) {
            ctx.logger.warn(`database source ${source.name} failed to start`, error);
          }
        }),
      ).then(() => undefined);
      return ready;
    },
    snapshot(maxRows) {
      snapshotting?.abort();
      if (maxRows <= 0 || running.length === 0) return;
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
    stop() {
      snapshotting?.abort();
      snapshotting = null;
      const stopping = running;
      running = [];
      context = null;
      for (const { source } of stopping) {
        void Promise.resolve(source.stop()).catch(() => undefined);
      }
    },
  };
}
