import { describeTables } from "./introspect.js";
import { snapshotTables } from "./snapshot.js";
import { createTriggerCapture } from "./triggerCapture.js";
import type {
  DatabaseChange,
  DatabaseSink,
  DatabaseSource,
  DatabaseStart,
  DatabaseTable,
  ExecuteSql,
} from "./types.js";

/** Structurally `ChangeCapture` from `@cavulsqa/mobile-db`. */
export interface ChangeCaptureLike {
  start(
    tables?: readonly string[] | "all",
  ): Promise<{ supported: true; tables: DatabaseTable[] } | { supported: false; reason: string }>;
  stop(): Promise<void>;
  subscribe(listener: (changeset: { bytes: Uint8Array; at: number }) => void): () => void;
}

/** Structurally `ChangeBus` from `@cavulsqa/reactive-db`. */
export interface ChangeBusLike {
  on(
    tables: string[],
    listener: (event: {
      table: string;
      type: DatabaseChange["type"];
      affectedRows?: number;
      affectedIds?: Array<string | number>;
      transactionId?: string;
      timestamp?: number;
    }) => void,
  ): () => void;
}

/**
 * Committed transactions as SQLite changesets, row values included, recorded inside the database
 * worker. With `execute`, sessions also start from a snapshot of the watched tables. When the engine
 * has no session extension (wa-sqlite, native builds without it), `fallback` is started instead.
 */
export function changesetSource(
  capture: ChangeCaptureLike,
  options: { name: string; execute?: ExecuteSql; fallback?: DatabaseSource },
): DatabaseSource {
  let unsubscribe: (() => void) | null = null;
  let active: DatabaseSource | null = null;
  let watched: DatabaseTable[] = [];

  const self: DatabaseSource = {
    name: options.name,
    async start(sink, tables) {
      unsubscribe = capture.subscribe(({ bytes, at }) => sink.changeset(bytes, at));
      const reply = await capture.start(tables);
      if (reply.supported) {
        active = self;
        watched = reply.tables;
        sink.schema(reply.tables);
        return { supported: true };
      }
      unsubscribe();
      unsubscribe = null;
      if (!options.fallback) return reply;
      active = options.fallback;
      return options.fallback.start(sink, tables);
    },
    async snapshot(sink, maxRows, signal) {
      if (active && active !== self) return active.snapshot?.(sink, maxRows, signal);
      if (!options.execute) return;
      await snapshotTables({ execute: options.execute, sink, tables: watched, maxRows, signal });
    },
    async stop() {
      if (active && active !== self) await active.stop();
      else if (active === self) await capture.stop();
      active = null;
      watched = [];
      unsubscribe?.();
      unsubscribe = null;
    },
  };
  return self;
}

/**
 * Committed rows with their values on any SQLite engine, through temporary triggers on the app's
 * own connection. A change bus says when to read them; without one they are read every two seconds.
 */
export function sqlChangesSource(options: {
  name: string;
  execute: ExecuteSql;
  bus?: ChangeBusLike;
  onError?: (error: unknown) => void;
}): DatabaseSource {
  let watched: DatabaseTable[] = [];
  let off: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let sink: DatabaseSink | null = null;
  const capture = createTriggerCapture(
    options.execute,
    (changes, at) => sink?.rows(changes, at),
    (error) => options.onError?.(error),
  );

  return {
    name: options.name,
    async start(next, tables): Promise<DatabaseStart> {
      sink = next;
      watched = (await describeTables(options.execute, tables)).filter((table) => table.tracked);
      await capture.install(watched);
      next.schema(watched);
      if (options.bus) off = options.bus.on(["*"], () => capture.requestDrain());
      else timer = setInterval(() => capture.requestDrain(), 2000);
      return { supported: true };
    },
    async snapshot(next, maxRows, signal) {
      await snapshotTables({
        execute: options.execute,
        sink: next,
        tables: watched,
        maxRows,
        signal,
      });
    },
    async stop() {
      off?.();
      off = null;
      if (timer !== null) clearInterval(timer);
      timer = null;
      capture.requestDrain();
      await capture.settled();
      await capture.uninstall();
      sink = null;
      watched = [];
    },
  };
}

/** Which table changed and how, without row values, from a reactive change bus. */
export function changeBusSource(
  bus: ChangeBusLike,
  options: { name: string; execute?: ExecuteSql },
): DatabaseSource {
  let off: (() => void) | null = null;
  let watched: DatabaseTable[] = [];

  return {
    name: options.name,
    async start(sink, tables): Promise<DatabaseStart> {
      off?.();
      if (options.execute) {
        watched = await describeTables(options.execute, tables);
        sink.schema(watched);
      }
      const allowed = tables === "all" ? null : new Set(tables);
      off = bus.on(["*"], (event) => {
        if (allowed && !allowed.has(event.table)) return;
        sink.change(
          {
            table: event.table,
            type: event.type,
            rows: event.affectedRows ?? null,
            ids: event.affectedIds?.slice(0, 50) ?? null,
            transactionId: event.transactionId ?? null,
          },
          event.timestamp ?? Date.now(),
        );
      });
      return { supported: true };
    },
    async snapshot(sink, maxRows, signal) {
      if (!options.execute) return;
      await snapshotTables({ execute: options.execute, sink, tables: watched, maxRows, signal });
    },
    stop() {
      off?.();
      off = null;
    },
  };
}
