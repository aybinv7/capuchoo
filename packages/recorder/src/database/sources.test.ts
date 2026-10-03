import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vite-plus/test";
import { sqlChangesSource } from "./sources.js";
import type { DatabaseSink, RowChange, SnapshotChunk } from "./types.js";

function openDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    "create table item (id integer primary key, name text, price real, photo blob); create table note (body text)",
  );
  const execute = async (sql: string, parameters: readonly unknown[] = []) =>
    db.prepare(sql).all(...(parameters as never[])) as Record<string, unknown>[];
  type Listener = (event: { table: string; type: "insert" | "update" | "delete" | "bulk" }) => void;
  const listeners = new Set<Listener>();
  const bus = {
    on: (_tables: string[], listener: Listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  const emit = () => listeners.forEach((listener) => listener({ table: "item", type: "bulk" }));
  return { db, execute, bus, emit };
}

function collectingSink() {
  const rows: RowChange[] = [];
  const snapshots: SnapshotChunk[] = [];
  const sink: DatabaseSink = {
    changeset: vi.fn(),
    change: vi.fn(),
    schema: vi.fn(),
    rows: (changes) => rows.push(...changes),
    snapshot: (chunk) => snapshots.push(chunk),
  };
  return { sink, rows, snapshots };
}

describe("sqlChangesSource", () => {
  it("records committed rows with their values, and nothing a rollback undid", async () => {
    const { db, execute, bus, emit } = openDb();
    const { sink, rows } = collectingSink();
    const source = sqlChangesSource({ name: "app", execute, bus });
    await source.start(sink, "all");

    expect(sink.schema).toHaveBeenCalledWith([
      expect.objectContaining({ name: "item", tracked: true }),
    ]);

    db.exec("insert into item values (1, 'bread', 1.5, x'00ff')");
    db.exec("begin; insert into item values (2, 'gone', 1, null); rollback");
    db.exec("update item set price = 2.25 where id = 1");
    db.exec("delete from item where id = 1");
    db.exec("insert into note values ('no key, not tracked')");
    emit();
    await source.stop();

    expect(rows).toEqual([
      {
        table: "item",
        op: "insert",
        old: null,
        new: { id: 1, name: "bread", price: 1.5, photo: "x'00FF'" },
      },
      {
        table: "item",
        op: "update",
        old: { id: 1, name: "bread", price: 1.5, photo: "x'00FF'" },
        new: { id: 1, name: "bread", price: 2.25, photo: "x'00FF'" },
      },
      {
        table: "item",
        op: "delete",
        old: { id: 1, name: "bread", price: 2.25, photo: "x'00FF'" },
        new: null,
      },
    ]);
  });

  it("leaves nothing behind once stopped", async () => {
    const { db, execute, bus } = openDb();
    const source = sqlChangesSource({ name: "app", execute, bus });
    await source.start(collectingSink().sink, ["item"]);
    await source.stop();
    const leftovers = db
      .prepare("select name from sqlite_temp_schema where name like 'capuchoo_%'")
      .all();
    expect(leftovers).toEqual([]);
  });

  it("snapshots in chunks, in key order, up to the row limit", async () => {
    const { db, execute, bus } = openDb();
    const insert = db.prepare("insert into item (id, name, price) values (?, ?, ?)");
    for (let id = 600; id >= 1; id--) insert.run(id, `item ${id}`, id / 10);
    const { sink, snapshots } = collectingSink();
    const source = sqlChangesSource({ name: "app", execute, bus });
    await source.start(sink, ["item"]);
    await source.snapshot!(sink, 400, new AbortController().signal);
    await source.stop();

    expect(
      snapshots.map((chunk) => [chunk.offset, chunk.rows.length, chunk.done, chunk.truncated]),
    ).toEqual([
      [0, 250, false, false],
      [250, 150, true, true],
    ]);
    expect(snapshots[0]!.columns).toEqual(["id", "name", "price", "photo"]);
    expect(snapshots[0]!.rows[0]).toEqual([1, "item 1", 0.1, null]);
  });

  it("announces the schema again with every session's snapshot, even without rows", async () => {
    const { execute, bus } = openDb();
    const announced: string[][] = [];
    const sink: DatabaseSink = {
      ...collectingSink().sink,
      schema: (tables) => announced.push(tables.map((table) => table.name)),
    };
    const source = sqlChangesSource({ name: "app", execute, bus });
    await source.start(sink, ["item"]);
    await source.snapshot!(sink, 0, new AbortController().signal);
    await source.stop();

    expect(announced).toEqual([["item"], ["item"]]);
  });
});
