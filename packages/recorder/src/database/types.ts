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

/** Where a source writes. The recorder turns each call into a `database` event. */
export interface DatabaseSink {
  /** A committed transaction in SQLite's changeset format. */
  changeset(bytes: Uint8Array, at: number): void;
  /** A write known only by its table and kind, for engines that cannot produce changesets. */
  change(change: DatabaseChange, at: number): void;
  schema(tables: DatabaseTable[]): void;
}

export type DatabaseStart = { supported: true } | { supported: false; reason: string };

/**
 * A database the recorder can watch. Implement it for any engine; the recorder only collects what
 * the source hands to the sink.
 */
export interface DatabaseSource {
  readonly name: string;
  start(sink: DatabaseSink, tables: string[] | "all"): Promise<DatabaseStart>;
  stop(): Promise<void> | void;
}
