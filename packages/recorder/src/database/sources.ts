import type { DatabaseChange, DatabaseSource, DatabaseStart, DatabaseTable } from "./types.js";

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
 * worker. When the engine cannot (wa-sqlite, a build without the session extension), `fallback` is
 * started instead.
 */
export function changesetSource(
  capture: ChangeCaptureLike,
  options: { name: string; fallback?: DatabaseSource },
): DatabaseSource {
  let unsubscribe: (() => void) | null = null;
  let active: DatabaseSource | null = null;

  const self: DatabaseSource = {
    name: options.name,
    async start(sink, tables) {
      unsubscribe = capture.subscribe(({ bytes, at }) => sink.changeset(bytes, at));
      const reply = await capture.start(tables);
      if (reply.supported) {
        active = self;
        sink.schema(reply.tables);
        return { supported: true };
      }
      unsubscribe();
      unsubscribe = null;
      if (!options.fallback) return reply;
      active = options.fallback;
      return options.fallback.start(sink, tables);
    },
    async stop() {
      if (active && active !== self) await active.stop();
      else if (active === self) await capture.stop();
      active = null;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
  return self;
}

/** Which table changed and how, without row values, from a reactive change bus. */
export function changeBusSource(bus: ChangeBusLike, options: { name: string }): DatabaseSource {
  let off: (() => void) | null = null;

  return {
    name: options.name,
    async start(sink, tables): Promise<DatabaseStart> {
      off?.();
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
    stop() {
      off?.();
      off = null;
    },
  };
}
