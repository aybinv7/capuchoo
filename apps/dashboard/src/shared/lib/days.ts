const DAY_MS = 86_400_000;

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** One row per day of the window, oldest first; a day the server did not report is `empty(day)`. */
export function fillDays<T extends { day: string }>(
  rows: readonly T[],
  days: number,
  now: number,
  empty: (day: string) => T,
): T[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const today = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const filled: T[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = isoDay(today - offset * DAY_MS);
    filled.push(byDay.get(day) ?? empty(day));
  }
  return filled;
}
