import { describe, expect, it } from "vite-plus/test";
import type { DecodedChange } from "./changeset";
import { tableAt } from "./db-model";
import type { DatabaseLaneEntry, DatabaseSnapshot } from "../types/recordings.types";

const KEY = [true, false, false];

function entry(
  t: number,
  ...changes: Array<Omit<DecodedChange, "table" | "indirect" | "primaryKey">>
): DatabaseLaneEntry {
  return {
    id: String(t),
    t,
    db: "app",
    kind: "changeset",
    changes: changes.map((change) => ({
      ...change,
      table: "item",
      indirect: false,
      primaryKey: KEY,
    })),
    table: null,
    type: null,
    rows: null,
    error: null,
  };
}

const snapshot: DatabaseSnapshot = {
  columns: ["id", "name", "qty"],
  rows: [
    [1, "bread", 3],
    [2, "milk", 1],
  ],
  at: 100,
  truncated: false,
};

const entries = [
  entry(50, { op: "insert", old: [], new: [2, "milk", 1] }),
  entry(150, { op: "update", old: [1, undefined, 3], new: [undefined, undefined, 9] }),
  entry(200, { op: "insert", old: [], new: [3, "tea", 2] }),
  entry(250, { op: "delete", old: [2, "milk", 1], new: [] }),
];

const view = (time: number) =>
  tableAt({ name: "item", columns: snapshot.columns, keyColumns: [0], snapshot, entries, time });

describe("tableAt", () => {
  it("replays forward from the snapshot with a status per row", () => {
    const later = view(260);
    expect(later.rows.map((row) => [row.key, row.status, row.values])).toEqual([
      ["1", "updated", [1, "bread", 9]],
      ["2", "deleted", [2, "milk", 1]],
      ["3", "inserted", [3, "tea", 2]],
    ]);
    expect(later.rows[0]!.changed.get(2)).toBe(3);
    expect(later.counts).toEqual({ inserted: 1, updated: 1, deleted: 1 });
    expect(later.complete).toBe(true);
  });

  it("is the snapshot itself at its own moment", () => {
    expect(view(100).rows.map((row) => [row.key, row.status])).toEqual([
      ["1", "baseline"],
      ["2", "inserted"],
    ]);
  });

  it("undoes changes backward before the snapshot", () => {
    const before = view(40);
    expect(before.rows.map((row) => row.key)).toEqual(["1"]);
    expect(before.rows[0]!.status).toBe("baseline");
  });

  it("knows only written rows without a snapshot", () => {
    const partial = tableAt({
      name: "item",
      columns: snapshot.columns,
      keyColumns: [0],
      snapshot: null,
      entries,
      time: 210,
    });
    expect(partial.complete).toBe(false);
    expect(partial.rows.map((row) => [row.key, row.status])).toEqual([
      ["1", "updated"],
      ["2", "inserted"],
      ["3", "inserted"],
    ]);
  });
});
