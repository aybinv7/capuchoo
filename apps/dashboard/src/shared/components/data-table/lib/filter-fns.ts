import type { FilterFn } from "@tanstack/vue-table";

/** Text form of a cell value, shared by facet matching and search. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    return `${value}`;
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value) ?? "";
}

/** Matches when the cell's value is one of the selected facet values. */
export const facetFilter: FilterFn<unknown> = (row, columnId, selected: unknown) => {
  if (!Array.isArray(selected) || selected.length === 0) return true;
  return selected.includes(cellText(row.getValue(columnId)));
};
facetFilter.autoRemove = (value: unknown) => !Array.isArray(value) || value.length === 0;

/** Every whitespace-separated term has to appear in one of the row's searchable columns. */
export const globalSearch: FilterFn<unknown> = (row, _columnId, query: unknown) => {
  const terms = cellText(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = row
    .getAllCells()
    .filter((cell) => cell.column.getCanGlobalFilter())
    .map((cell) => cellText(cell.getValue()).toLowerCase())
    .join(" ");
  return terms.every((term) => haystack.includes(term));
};
