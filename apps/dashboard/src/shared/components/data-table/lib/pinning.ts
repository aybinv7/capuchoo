import type { Column } from "@tanstack/vue-table";
import type { CSSProperties } from "vue";

/**
 * Pinned columns stick at the summed width of the pinned columns before them, so each one gets a
 * fixed width; unpinned columns keep the table's automatic layout.
 */
export function pinningStyle<T>(column: Column<T, unknown>): CSSProperties | undefined {
  const side = column.getIsPinned();
  if (!side) return undefined;
  const width = `${column.getSize()}px`;
  return {
    position: "sticky",
    zIndex: 1,
    width,
    minWidth: width,
    maxWidth: width,
    left: side === "left" ? `${column.getStart("left")}px` : undefined,
    right: side === "right" ? `${column.getAfter("right")}px` : undefined,
  };
}

export function pinningEdge<T>(column: Column<T, unknown>): string | undefined {
  const side = column.getIsPinned();
  if (side === "left" && column.getIsLastColumn("left"))
    return "shadow-[inset_-1px_0_0_var(--border)]";
  if (side === "right" && column.getIsFirstColumn("right"))
    return "shadow-[inset_1px_0_0_var(--border)]";
  return undefined;
}
