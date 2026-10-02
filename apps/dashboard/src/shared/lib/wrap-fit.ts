const ROW_TOLERANCE_PX = 2;

/**
 * How many items of a wrapped list fit in `rows` rows, given each item's top offset in the full
 * layout. When some are left out, one more is dropped to make room for the "+N" item that names them.
 */
export function fitWithinRows(tops: readonly number[], rows: number): number {
  if (rows <= 0) return 0;
  let row = 0;
  let rowTop = tops[0] ?? 0;
  for (let index = 0; index < tops.length; index += 1) {
    const top = tops[index] ?? rowTop;
    if (top > rowTop + ROW_TOLERANCE_PX) {
      row += 1;
      rowTop = top;
    }
    if (row >= rows) return Math.max(0, index - 1);
  }
  return tops.length;
}
