import { describe, expect, it } from "vite-plus/test";
import { databaseActivity } from "./activity";
import type { DatabaseLaneEntry } from "../types/recordings.types";

const write = (
  id: string,
  t: number,
  changes: Array<{ table: string; op: "insert" | "update" | "delete" }>,
  db = "app",
): DatabaseLaneEntry =>
  ({
    id,
    t,
    db,
    kind: "changeset",
    changes: changes.map((change) => ({ ...change, primaryKey: [], old: [], new: [] })),
    table: null,
    type: null,
    rows: null,
    error: null,
  }) as unknown as DatabaseLaneEntry;

describe("databaseActivity", () => {
  it("reads a burst of writes as one line that opens its first write", () => {
    const items = databaseActivity([
      write("a", 1000, [{ table: "customer", op: "insert" }]),
      write("b", 1200, [
        { table: "sales_order", op: "insert" },
        { table: "order_line", op: "insert" },
      ]),
      write("c", 1900, [
        { table: "sales_order", op: "update" },
        { table: "tag", op: "delete" },
      ]),
      write("d", 5000, [{ table: "sales_order", op: "delete" }]),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "a",
      t: 1000,
      title: "5 rows written · customer, sales_order, order_line +1",
      detail: "+3 ~1 −1",
    });
    expect(items[1]).toMatchObject({ id: "d", title: "1 row written · sales_order", detail: "−1" });
  });

  it("keeps databases apart", () => {
    const items = databaseActivity([
      write("a", 1000, [{ table: "t", op: "insert" }], "app"),
      write("b", 1100, [{ table: "t", op: "insert" }], "cache"),
    ]);
    expect(items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
