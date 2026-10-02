import type { BarGranularity } from "../types";

const KEY = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}))?$/;
const weekday = new Intl.DateTimeFormat("en", { weekday: "short" });
const monthName = new Intl.DateTimeFormat("en", { month: "short" });

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number | null;
}

function parts(key: string): Parts | null {
  const match = KEY.exec(key);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4] === undefined ? null : Number(match[4]),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** An axis label: `26/09` for a day, `14h` for an hour, the day again at midnight. */
export function tickLabel(key: string, granularity: BarGranularity): string {
  const value = parts(key);
  if (!value) return key;
  const day = `${pad(value.day)}/${pad(value.month)}`;
  if (granularity === "day" || value.hour === null || value.hour === 0) return day;
  return `${pad(value.hour)}h`;
}

/** A tooltip heading: `Sat 26 Sep` for a day, `Sat 26 Sep · 14:00` for an hour. */
export function bucketTitle(key: string, granularity: BarGranularity): string {
  const value = parts(key);
  if (!value) return key;
  const date = new Date(value.year, value.month - 1, value.day);
  const day = `${weekday.format(date)} ${value.day} ${monthName.format(date)}`;
  if (granularity === "day" || value.hour === null) return day;
  return `${day} · ${pad(value.hour)}:00`;
}
