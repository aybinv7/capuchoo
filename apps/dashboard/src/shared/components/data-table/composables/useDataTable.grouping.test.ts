import type { ColumnFiltersState } from "@tanstack/vue-table";
import { describe, expect, it } from "vite-plus/test";
import { effectScope, nextTick, ref } from "vue";
import { DEFAULT_FEATURES, type AnyColumnDef } from "../types";
import { useDataTable } from "./useDataTable";

interface Item {
  id: string;
  kind: string;
  name: string;
}

const items: Item[] = [
  { id: "1", kind: "ota", name: "a" },
  { id: "2", kind: "native", name: "b" },
  { id: "3", kind: "ota", name: "c" },
];

const columns: AnyColumnDef<Item>[] = [
  { id: "kind", accessorFn: (item) => item.kind, meta: { title: "Kind", groupable: true } },
  { id: "name", accessorFn: (item) => item.name, meta: { title: "Name" } },
];

function setup(incomplete = false) {
  const scope = effectScope();
  const controller = scope.run(() =>
    useDataTable<Item>({
      data: items,
      columns,
      getRowId: (item) => item.id,
      features: { ...DEFAULT_FEATURES, grouping: true },
      search: ref(""),
      filters: ref<ColumnFiltersState>([]),
      serverFiltering: false,
      incomplete,
    }),
  )!;
  return { controller, stop: () => scope.stop() };
}

describe("useDataTable grouping", () => {
  it("groups rows under expanded headers and keeps data rows for export", async () => {
    const { controller, stop } = setup();
    controller.toggleGroup("kind");
    await nextTick();
    const rows = controller.table.getRowModel().rows;
    const headers = rows.filter((row) => row.getIsGrouped());
    expect(headers.map((row) => [row.groupingValue, row.getLeafRows().length])).toEqual([
      ["ota", 2],
      ["native", 1],
    ]);
    expect(rows).toHaveLength(5);
    expect(controller.leafRows.value.map((item) => item.id)).toEqual(["1", "3", "2"]);

    expect(controller.table.getPageCount()).toBe(1);

    controller.setAllExpanded(false);
    await nextTick();
    expect(controller.table.getRowModel().rows).toHaveLength(2);
    stop();
  });

  it("ignores columns that are not groupable", async () => {
    const { controller, stop } = setup();
    controller.toggleGroup("name");
    await nextTick();
    expect(controller.grouping.value).toEqual([]);
    stop();
  });

  it("refuses to group a partly loaded table", async () => {
    const { controller, stop } = setup(true);
    expect(controller.groupingEnabled.value).toBe(true);
    expect(controller.groupable.value).toBe(false);
    controller.toggleGroup("kind");
    await nextTick();
    expect(controller.table.getRowModel().rows.some((row) => row.getIsGrouped())).toBe(false);
    stop();
  });
});
