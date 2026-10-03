import { quoteIdentifier } from "./introspect.js";
import type { DatabaseSink, DatabaseTable, ExecuteSql } from "./types.js";

const CHUNK_ROWS = 250;
const PAUSE_MS = 30;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads each table's starting state in small chunks with a pause between them, so the app's own
 * queries never wait long behind it on the database's single connection.
 */
export async function snapshotTables(input: {
  execute: ExecuteSql;
  sink: DatabaseSink;
  tables: readonly DatabaseTable[];
  maxRows: number;
  signal: AbortSignal;
}): Promise<void> {
  if (input.maxRows <= 0) return;
  for (const table of input.tables) {
    const columns = table.columns.map((column) => column.name);
    const keys = table.columns
      .filter((column) => column.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((column) => quoteIdentifier(column.name));
    const order = keys.length > 0 ? keys.join(", ") : "rowid";
    const select = columns.map(quoteIdentifier).join(", ");
    let offset = 0;
    while (!input.signal.aborted) {
      const limit = Math.min(CHUNK_ROWS, input.maxRows - offset);
      const rows = await input.execute(
        `select ${select} from ${quoteIdentifier(table.name)} order by ${order} limit ? offset ?`,
        [limit + 1, offset],
      );
      const page = rows.slice(0, limit);
      const more = rows.length > limit;
      const reachedLimit = offset + page.length >= input.maxRows;
      input.sink.snapshot({
        table: table.name,
        columns,
        rows: page.map((row) => columns.map((column) => row[column] ?? null)),
        offset,
        done: !more || reachedLimit,
        truncated: more && reachedLimit,
      });
      offset += page.length;
      if (!more || reachedLimit) break;
      await pause(PAUSE_MS);
    }
  }
}
