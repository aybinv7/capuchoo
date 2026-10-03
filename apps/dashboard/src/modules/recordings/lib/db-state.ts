import { changeKey, type ChangeValue } from "./changeset";
import type { DatabaseLaneEntry } from "../types/recordings.types";

export interface RowState {
  key: string;
  /** Last known value per column; `undefined` where the session never saw it. */
  values: ChangeValue[];
  deleted: boolean;
  /** When this row last changed, wall clock. */
  changedAt: number;
  /** Columns changed by the last write, by position. */
  touched: number[];
}

export type TableState = Map<string, RowState>;

/**
 * The rows this session wrote, as they stood at `time`: every changeset up to then applied in
 * order. Only rows the session touched appear - the device's database is never uploaded whole.
 */
export function stateAt(
  entries: readonly DatabaseLaneEntry[],
  time: number,
  db: string,
): Map<string, TableState> {
  const tables = new Map<string, TableState>();
  for (const entry of entries) {
    if (entry.t > time) break;
    if (entry.db !== db) continue;
    for (const change of entry.changes) {
      let table = tables.get(change.table);
      if (!table) {
        table = new Map();
        tables.set(change.table, table);
      }
      const key = changeKey(change);
      const previous = table.get(key);
      const values = [...(previous?.values ?? change.old)];
      const touched: number[] = [];
      if (change.op === "delete") {
        change.old.forEach((value, index) => {
          if (value !== undefined) values[index] = value;
        });
      } else {
        change.new.forEach((value, index) => {
          if (value === undefined) return;
          if (values[index] !== value) touched.push(index);
          values[index] = value;
        });
        if (change.op === "update") {
          change.old.forEach((value, index) => {
            if (values[index] === undefined && value !== undefined) values[index] = value;
          });
        }
      }
      table.set(key, {
        key,
        values,
        deleted: change.op === "delete",
        changedAt: entry.t,
        touched,
      });
    }
  }
  return tables;
}
