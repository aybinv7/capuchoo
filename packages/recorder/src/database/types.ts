export interface DatabaseColumn {
  name: string;
  type: string;
  pk: number;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  tracked: boolean;
}

export interface DatabaseChange {
  table: string;
  type: "insert" | "update" | "delete" | "bulk";
  rows: number | null;
  ids: Array<string | number> | null;
  transactionId: string | null;
}

/** One row written, with its values by column name; `old` is null for an insert, `new` for a delete. */
export interface RowChange {
  table: string;
  op: "insert" | "update" | "delete";
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
}

/** Part of a table's starting state: rows as arrays in `columns` order. */
export interface SnapshotChunk {
  table: string;
  columns: string[];
  rows: unknown[][];
  offset: number;
  /** The last chunk of this table, or the table was cut at the row limit. */
  done: boolean;
  truncated: boolean;
}

/** Where a source writes. The recorder turns each call into a `database` event. */
export interface DatabaseSink {
  /** A committed transaction in SQLite's changeset format. */
  changeset(bytes: Uint8Array, at: number): void;
  /** Committed rows with their values, for engines without the session extension. */
  rows(changes: RowChange[], at: number): void;
  /** A write known only by its table and kind, for engines that report nothing more. */
  change(change: DatabaseChange, at: number): void;
  schema(tables: DatabaseTable[]): void;
  snapshot(chunk: SnapshotChunk): void;
}

export type DatabaseStart = { supported: true } | { supported: false; reason: string };

/** Runs one statement on the app's own connection and returns its rows as objects. */
export type ExecuteSql = (
  sql: string,
  parameters?: readonly unknown[],
) => Promise<Record<string, unknown>[]>;

/**
 * A database the recorder can watch. Implement it for any engine; the recorder only collects what
 * the source hands to the sink.
 */
export interface DatabaseSource {
  readonly name: string;
  start(sink: DatabaseSink, tables: string[] | "all"): Promise<DatabaseStart>;
  /** Reads the starting state of the watched tables, a chunk at a time. */
  snapshot?(sink: DatabaseSink, maxRows: number, signal: AbortSignal): Promise<void>;
  stop(): Promise<void> | void;
}
