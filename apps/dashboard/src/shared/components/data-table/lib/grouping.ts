/** Deeper than two levels a table stops being readable; the menu refuses a third. */
export const MAX_GROUP_LEVELS = 2;

/** Adds `id` as the next level, or removes it and the levels nested under it. */
export function toggleGrouping(current: readonly string[], id: string): string[] {
  const at = current.indexOf(id);
  if (at !== -1) return current.slice(0, at);
  if (current.length >= MAX_GROUP_LEVELS) return [...current];
  return [...current, id];
}

/** Only columns that exist and allow grouping, in order, without duplicates, capped. */
export function sanitizeGrouping(
  grouping: readonly string[],
  groupable: ReadonlySet<string>,
): string[] {
  const kept: string[] = [];
  for (const id of grouping)
    if (groupable.has(id) && !kept.includes(id) && kept.length < MAX_GROUP_LEVELS) kept.push(id);
  return kept;
}

interface GroupableRow<T> {
  original: T;
  subRows: GroupableRow<T>[];
  getIsGrouped(): boolean;
}

/** The data rows under a list of possibly grouped rows, in display order. */
export function leafOriginals<T>(rows: readonly GroupableRow<T>[]): T[] {
  const out: T[] = [];
  const walk = (list: readonly GroupableRow<T>[]) => {
    for (const row of list) {
      if (row.getIsGrouped()) walk(row.subRows);
      else out.push(row.original);
    }
  };
  walk(rows);
  return out;
}

/** What a group header says for its value: the column's own label, else the value, else none. */
export function groupValueLabel(
  value: unknown,
  label?: (value: never) => string,
): { text: string; empty: boolean } {
  if (value === null || value === undefined || value === "")
    return { text: label ? label("" as never) || "None" : "None", empty: true };
  if (label) return { text: label(value as never), empty: false };
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", empty: false };
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint")
    return { text: String(value), empty: false };
  return { text: JSON.stringify(value) ?? "", empty: false };
}
