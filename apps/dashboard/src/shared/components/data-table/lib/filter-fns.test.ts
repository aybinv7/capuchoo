import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/vue-table";
import { describe, expect, it } from "vite-plus/test";
import { cellText, facetFilter, globalSearch } from "./filter-fns";

interface Row {
  name: string;
  env: string | null;
  signed: boolean;
  hidden: string;
}

const ROWS: Row[] = [
  { name: "prod-geant", env: "prod", signed: true, hidden: "client alpha" },
  { name: "prod-proxima", env: "prod", signed: false, hidden: "client beta" },
  { name: "dev", env: null, signed: true, hidden: "internal" },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { id: "name", accessorFn: (row) => row.name },
  { id: "env", accessorFn: (row) => row.env },
  { id: "signed", accessorFn: (row) => row.signed, enableGlobalFilter: false },
  { id: "hidden", accessorFn: (row) => row.hidden },
];

function visible(globalFilter: string, columnFilters: ColumnFiltersState = []): string[] {
  const table = createTable<Row>({
    data: ROWS,
    columns: COLUMNS,
    state: { globalFilter, columnFilters, columnPinning: {}, columnVisibility: {} },
    onStateChange: () => undefined,
    renderFallbackValue: null,
    defaultColumn: { filterFn: facetFilter as FilterFn<Row> },
    globalFilterFn: globalSearch as FilterFn<Row>,
    getColumnCanGlobalFilter: (column) => column.columnDef.enableGlobalFilter !== false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  return table.getFilteredRowModel().rows.map((row) => row.original.name);
}

describe("cell text", () => {
  it("renders scalars plainly and objects as JSON", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(false)).toBe("false");
    expect(cellText(12)).toBe("12");
    expect(cellText({ a: 1 })).toBe('{"a":1}');
  });
});

describe("global search", () => {
  it("requires every term, in any searchable column", () => {
    expect(visible("prod beta")).toEqual(["prod-proxima"]);
    expect(visible("PROD")).toEqual(["prod-geant", "prod-proxima"]);
  });

  it("searches columns the viewer has hidden but not excluded ones", () => {
    expect(visible("internal")).toEqual(["dev"]);
    expect(visible("true")).toEqual([]);
  });
});

describe("facet filter", () => {
  it("keeps rows whose value is selected, including booleans", () => {
    expect(visible("", [{ id: "signed", value: ["false"] }])).toEqual(["prod-proxima"]);
    expect(visible("", [{ id: "env", value: ["prod"] }])).toEqual(["prod-geant", "prod-proxima"]);
  });

  it("combines with search", () => {
    expect(visible("geant", [{ id: "env", value: ["prod"] }])).toEqual(["prod-geant"]);
  });

  it("drops an empty selection instead of hiding everything", () => {
    expect(facetFilter.autoRemove?.([])).toBe(true);
  });
});
