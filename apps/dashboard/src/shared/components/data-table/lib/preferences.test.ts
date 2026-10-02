import { describe, expect, it } from "vite-plus/test";
import {
  defaultPreferences,
  moveColumn,
  pruneToColumns,
  resolveOrder,
  sanitizePreferences,
} from "./preferences";

describe("table preferences", () => {
  const fallback = defaultPreferences(20);

  it("falls back on anything that is not an object", () => {
    expect(sanitizePreferences(null, fallback)).toBe(fallback);
    expect(sanitizePreferences("x", fallback)).toBe(fallback);
    expect(sanitizePreferences([], fallback)).toBe(fallback);
  });

  it("keeps valid fields and replaces invalid ones", () => {
    const result = sanitizePreferences(
      {
        density: "tiny",
        pageSize: 50,
        visibility: { a: false, b: "no" },
        order: ["a", 3, "b"],
        pinning: { left: ["a"], right: "b" },
        grouping: ["channel", 4],
      },
      fallback,
    );
    expect(result).toEqual({
      density: "normal",
      pageSize: 50,
      visibility: { a: false },
      order: ["a", "b"],
      pinning: { left: ["a"], right: [] },
      grouping: ["channel"],
    });
  });

  it("refuses a page size the pager does not offer", () => {
    expect(sanitizePreferences({ pageSize: 7 }, fallback).pageSize).toBe(20);
  });

  it("forgets columns that no longer exist", () => {
    const pruned = pruneToColumns(
      {
        ...fallback,
        visibility: { a: false, gone: false },
        order: ["gone", "a"],
        pinning: { left: ["gone"], right: ["a"] },
      },
      ["a"],
    );
    expect(pruned.visibility).toEqual({ a: false });
    expect(pruned.order).toEqual(["a"]);
    expect(pruned.pinning).toEqual({ left: [], right: ["a"] });
  });
});

describe("column reordering", () => {
  it("moves right and left onto the target position", () => {
    expect(moveColumn(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveColumn(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("leaves the order alone for unknown ids or a drop on itself", () => {
    expect(moveColumn(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(moveColumn(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});

describe("display order", () => {
  const fixed = new Set(["select", "actions"]);
  const defined = ["select", "a", "b", "c", "actions"];

  it("uses the definition order when nothing is stored", () => {
    expect(resolveOrder(defined, fixed, [])).toEqual(defined);
  });

  it("applies the stored order to movable columns only", () => {
    expect(resolveOrder(defined, fixed, ["c", "actions", "a", "b"])).toEqual([
      "select",
      "c",
      "a",
      "b",
      "actions",
    ]);
  });

  it("appends columns added since the order was stored and drops removed ones", () => {
    expect(resolveOrder(defined, fixed, ["b", "gone"])).toEqual([
      "select",
      "b",
      "a",
      "c",
      "actions",
    ]);
  });
});
