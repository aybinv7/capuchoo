import { tableNames } from "./db-model";
import type { DatabaseLaneEntry, Lanes } from "../types/recordings.types";

export interface TableSummary {
  name: string;
  rows: number | null;
  inserted: number;
  updated: number;
  deleted: number;
  /** Wall clock of the last change at or before the playhead. */
  lastChange: number | null;
}

export function databasesOf(lanes: Lanes): string[] {
  const names = new Set([...Object.keys(lanes.schemas), ...Object.keys(lanes.snapshots)]);
  for (const entry of lanes.database) names.add(entry.db);
  return [...names].sort();
}

export function entriesOf(lanes: Lanes, db: string): DatabaseLaneEntry[] {
  return lanes.database.filter((entry) => entry.db === db);
}

/** What the table list shows: how many writes of each kind each table took up to the playhead. */
export function summarizeTables(lanes: Lanes, db: string, time: number): TableSummary[] {
  const snapshots = lanes.snapshots[db] ?? {};
  const entries = entriesOf(lanes, db);
  const names = new Set([
    ...tableNames(snapshots, entries),
    ...Object.keys(lanes.schemas[db] ?? {}),
  ]);
  const summaries = new Map<string, TableSummary>();
  for (const name of names) {
    summaries.set(name, {
      name,
      rows: snapshots[name]?.rows.length ?? null,
      inserted: 0,
      updated: 0,
      deleted: 0,
      lastChange: null,
    });
  }
  for (const entry of entries) {
    if (entry.t > time) break;
    for (const change of entry.changes) {
      const summary = summaries.get(change.table);
      if (!summary) continue;
      if (change.op === "insert") summary.inserted++;
      else if (change.op === "update") summary.updated++;
      else summary.deleted++;
      summary.lastChange = entry.t;
    }
  }
  return [...summaries.values()].sort(
    (a, b) => (b.lastChange ?? -1) - (a.lastChange ?? -1) || a.name.localeCompare(b.name),
  );
}

/** Columns and key of a table, from the schema the device announced, else what the data shows. */
export function tableShape(
  lanes: Lanes,
  db: string,
  table: string,
): { columns: string[]; keyColumns: number[] } {
  const schema = lanes.schemas[db]?.[table];
  if (schema && schema.length > 0) {
    return {
      columns: schema.map((column) => column.name),
      keyColumns: schema.flatMap((column, index) => (column.pk > 0 ? [index] : [])),
    };
  }
  const snapshot = lanes.snapshots[db]?.[table];
  const sample = lanes.database
    .flatMap((entry) => entry.changes)
    .find((change) => change.table === table);
  const width = snapshot?.columns.length ?? sample?.primaryKey.length ?? 0;
  return {
    columns:
      snapshot?.columns ?? Array.from({ length: width }, (_, index) => `column ${index + 1}`),
    keyColumns: sample ? sample.primaryKey.flatMap((key, index) => (key ? [index] : [])) : [],
  };
}
