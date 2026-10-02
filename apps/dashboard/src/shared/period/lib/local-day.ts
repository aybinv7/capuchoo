const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/** A local calendar day as `YYYY-MM-DD`. */
export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** A local hour as `YYYY-MM-DDTHH`, the shape the activity endpoint buckets by. */
export const hourKey = (date: Date): string => `${dayKey(date)}T${pad(date.getHours())}`;

/** Local midnight of a `YYYY-MM-DD` day; null for anything that is not a real calendar day. */
export function parseDayKey(key: string): Date | null {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

/** Local midnight of the day `date` falls in. */
export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Local midnight `days` calendar days away; a DST day is still one day, not 24 hours. */
export const addDays = (date: Date, days: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Whole local days between two local midnights, tolerant of 23 and 25 hour days. */
export const daysBetween = (start: Date, end: Date): number =>
  Math.round((end.getTime() - start.getTime()) / 86_400_000);
