import type { ChangeValue, DecodedChange } from "./changeset";
import type { DatabaseLaneEntry, DatabaseSnapshot } from "../types/recordings.types";

export type RowStatus = "baseline" | "inserted" | "updated" | "deleted";

export interface RowView {
  key: string;
  values: ChangeValue[];
  status: RowStatus;
  /** Wall clock of the last change at or before the playhead; null for an untouched row. */
  changedAt: number | null;
  /** Columns changed by the session so far, with their value before the first change. */
  changed: Map<number, ChangeValue>;
}

export interface TableView {
  name: string;
  columns: string[];
  keyColumns: number[];
  rows: RowView[];
  counts: { inserted: number; updated: number; deleted: number };
  /** Rows came from a snapshot; without one, only rows the session wrote are known. */
  complete: boolean;
  truncated: boolean;
}

interface TableEvent {
  t: number;
  change: DecodedChange;
}

const NO_KEY = "∅";

function keyOf(values: readonly ChangeValue[], keyColumns: readonly number[]): string {
  if (keyColumns.length === 0)
    return JSON.stringify(values, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v));
  return keyColumns.map((index) => String(values[index] ?? NO_KEY)).join("·");
}

function changeValues(change: DecodedChange): ChangeValue[] {
  return change.op === "insert" ? change.new : change.old;
}

function merged(base: readonly ChangeValue[], patch: readonly ChangeValue[]): ChangeValue[] {
  const length = Math.max(base.length, patch.length);
  return Array.from({ length }, (_, index) =>
    patch[index] !== undefined ? patch[index] : base[index],
  );
}

/** Every table any source of `db` touched, with its columns: from the schema, else the snapshot. */
export function tableNames(
  snapshots: Record<string, DatabaseSnapshot>,
  entries: readonly DatabaseLaneEntry[],
): string[] {
  const names = new Set(Object.keys(snapshots));
  for (const entry of entries) for (const change of entry.changes) names.add(change.table);
  return [...names].sort();
}

/**
 * A table as it stood at `time`: the snapshot, with the session's changes replayed forward to the
 * playhead or undone backward when the playhead is before the snapshot. Status is what the session
 * did to each row up to the playhead.
 */
export function tableAt(input: {
  name: string;
  columns: string[];
  keyColumns: number[];
  snapshot: DatabaseSnapshot | null;
  entries: readonly DatabaseLaneEntry[];
  time: number;
}): TableView {
  const { name, keyColumns, snapshot, time } = input;
  const events: TableEvent[] = [];
  for (const entry of input.entries) {
    for (const change of entry.changes) {
      if (change.table === name) events.push({ t: entry.t, change });
    }
  }

  const rows = new Map<string, ChangeValue[]>();
  for (const row of (snapshot?.rows ?? []) as ChangeValue[][]) {
    rows.set(keyOf(row, keyColumns), [...row]);
  }
  const baselineAt = snapshot?.at ?? Number.NEGATIVE_INFINITY;

  for (const { t, change } of events) {
    if (t <= baselineAt || t > time) continue;
    const key = keyOf(changeValues(change), keyColumns);
    if (change.op === "delete") rows.delete(key);
    else rows.set(key, merged(rows.get(key) ?? change.old, change.new));
  }
  for (let index = events.length - 1; index >= 0; index--) {
    const { t, change } = events[index]!;
    if (t <= time || t > baselineAt) continue;
    const key = keyOf(changeValues(change), keyColumns);
    if (change.op === "insert") rows.delete(key);
    else rows.set(key, merged(rows.get(key) ?? [], change.old));
  }

  const status = new Map<
    string,
    { status: RowStatus; at: number; changed: Map<number, ChangeValue>; values?: ChangeValue[] }
  >();
  for (const { t, change } of events) {
    if (t > time) break;
    const key = keyOf(changeValues(change), keyColumns);
    const previous = status.get(key);
    const changed = previous?.changed ?? new Map<number, ChangeValue>();
    if (change.op === "update") {
      change.new.forEach((value, column) => {
        if (value !== undefined && !changed.has(column)) changed.set(column, change.old[column]);
      });
    }
    const next: RowStatus =
      change.op === "delete"
        ? "deleted"
        : change.op === "insert" || previous?.status === "inserted"
          ? "inserted"
          : "updated";
    status.set(key, {
      status: next,
      at: t,
      changed,
      values: change.op === "delete" ? merged(rows.get(key) ?? [], change.old) : undefined,
    });
  }

  const views: RowView[] = [];
  const counts = { inserted: 0, updated: 0, deleted: 0 };
  for (const [key, values] of rows) {
    const known = status.get(key);
    if (known?.status === "inserted" || known?.status === "updated") counts[known.status]++;
    views.push({
      key,
      values,
      status: known && known.status !== "deleted" ? known.status : "baseline",
      changedAt: known?.at ?? null,
      changed: known?.changed ?? new Map(),
    });
  }
  for (const [key, known] of status) {
    if (known.status !== "deleted" || rows.has(key)) continue;
    counts.deleted++;
    views.push({
      key,
      values: known.values ?? [],
      status: "deleted",
      changedAt: known.at,
      changed: known.changed,
    });
  }

  views.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  return {
    name,
    columns: input.columns,
    keyColumns,
    rows: views,
    counts,
    complete: snapshot !== null && !snapshot.truncated,
    truncated: snapshot?.truncated ?? false,
  };
}
