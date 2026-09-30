import type { ColumnPinningState, VisibilityState } from "@tanstack/vue-table";
import { DENSITIES, PAGE_SIZES, type Density } from "../types";

/** What a viewer chose for one table, kept across visits. */
export interface TablePreferences {
  density: Density;
  pageSize: number;
  visibility: VisibilityState;
  order: string[];
  pinning: ColumnPinningState;
}

export function defaultPreferences(pageSize = PAGE_SIZES[0]!): TablePreferences {
  return {
    density: "normal",
    pageSize,
    visibility: {},
    order: [],
    pinning: { left: [], right: [] },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

/**
 * Stored preferences come from a previous build or another tab; anything that no longer fits the
 * shape falls back to the default instead of breaking the table.
 */
export function sanitizePreferences(stored: unknown, fallback: TablePreferences): TablePreferences {
  if (!isRecord(stored)) return fallback;
  const density = DENSITIES.includes(stored.density as Density)
    ? (stored.density as Density)
    : fallback.density;
  const pageSize = PAGE_SIZES.includes(stored.pageSize as number)
    ? (stored.pageSize as number)
    : fallback.pageSize;
  const visibility: VisibilityState = {};
  if (isRecord(stored.visibility))
    for (const [key, value] of Object.entries(stored.visibility))
      if (typeof value === "boolean") visibility[key] = value;
  const pinning = isRecord(stored.pinning)
    ? { left: stringList(stored.pinning.left), right: stringList(stored.pinning.right) }
    : fallback.pinning;
  return { density, pageSize, visibility, order: stringList(stored.order), pinning };
}

/** Drops ids of columns that no longer exist, so a renamed column cannot hide forever. */
export function pruneToColumns(prefs: TablePreferences, ids: readonly string[]): TablePreferences {
  const known = new Set(ids);
  return {
    ...prefs,
    visibility: Object.fromEntries(
      Object.entries(prefs.visibility).filter(([id]) => known.has(id)),
    ),
    order: prefs.order.filter((id) => known.has(id)),
    pinning: {
      left: (prefs.pinning.left ?? []).filter((id) => known.has(id)),
      right: (prefs.pinning.right ?? []).filter((id) => known.has(id)),
    },
  };
}

/** Moves `id` to the position of `target`, before it when dragging left and after it when right. */
export function moveColumn(order: readonly string[], id: string, target: string): string[] {
  const from = order.indexOf(id);
  const to = order.indexOf(target);
  if (from === -1 || to === -1 || from === to) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/**
 * The display order: the stored order for movable columns, columns added since appended in
 * definition order, and fixed columns (selection, row actions) kept in their defined slots.
 */
export function resolveOrder(
  defined: readonly string[],
  fixed: ReadonlySet<string>,
  stored: readonly string[],
): string[] {
  const known = new Set(defined);
  const movable = stored.filter((id) => known.has(id) && !fixed.has(id));
  const seen = new Set(movable);
  for (const id of defined) if (!fixed.has(id) && !seen.has(id)) movable.push(id);
  let next = 0;
  return defined.map((id) => (fixed.has(id) ? id : movable[next++]!));
}
