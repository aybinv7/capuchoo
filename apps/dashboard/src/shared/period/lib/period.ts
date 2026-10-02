import { addDays, dayKey, daysBetween, parseDayKey, startOfDay } from "./local-day";

export const PERIOD_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "all", label: "All kept history" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["value"];

/** A preset, or the inclusive local days `start`..`end` as `YYYY-MM-DD`. */
export type Period =
  | { kind: "preset"; preset: PeriodPreset }
  | { kind: "custom"; start: string; end: string };

/** A period pinned to instants: `start` is a local midnight, `end` the exclusive one after it. */
export interface ResolvedPeriod {
  start: Date;
  end: Date;
  firstDay: string;
  lastDay: string;
  days: number;
}

export const DEFAULT_PERIOD: Period = Object.freeze({ kind: "preset", preset: "7d" });

/** The server's default `DEVICE_EVENT_RETENTION_DAYS`, used while the real value is unknown. */
export const DEFAULT_RETENTION_DAYS = 90;

/** The activity endpoint refuses more than 366 days; one less absorbs DST hours. */
export const MAX_PERIOD_DAYS = 365;

const PRESETS = new Set<string>(PERIOD_PRESETS.map((preset) => preset.value));

const isPreset = (value: string): value is PeriodPreset => PRESETS.has(value);

function single(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

/** How many days back a period can reach: the retention, else the server default, capped. */
export const keptDays = (days: number | null | undefined): number =>
  typeof days === "number" && Number.isFinite(days) && days >= 1
    ? Math.min(Math.floor(days), MAX_PERIOD_DAYS)
    : DEFAULT_RETENTION_DAYS;

/** The period a URL names, `?range=30d` or `?from=…&to=…`; anything unreadable is the default. */
export function parsePeriod(query: Readonly<Record<string, unknown>>): Period {
  const range = single(query.range);
  if (range !== null) return isPreset(range) ? { kind: "preset", preset: range } : DEFAULT_PERIOD;
  const from = single(query.from);
  const to = single(query.to);
  if (from === null || to === null) return DEFAULT_PERIOD;
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  if (!start || !end || start > end) return DEFAULT_PERIOD;
  return { kind: "custom", start: from, end: to };
}

/** The query parameters naming a period; the default names none, so its URL stays clean. */
export function periodQuery(period: Period): { range?: string; from?: string; to?: string } {
  if (period.kind === "custom") return { from: period.start, to: period.end };
  return period.preset === "7d" ? {} : { range: period.preset };
}

export function isSamePeriod(a: Period, b: Period): boolean {
  if (a.kind === "preset" && b.kind === "preset") return a.preset === b.preset;
  if (a.kind === "custom" && b.kind === "custom") return a.start === b.start && a.end === b.end;
  return false;
}

function span(start: Date, end: Date): ResolvedPeriod {
  return {
    start,
    end,
    firstDay: dayKey(start),
    lastDay: dayKey(addDays(end, -1)),
    days: daysBetween(start, end),
  };
}

function presetSpan(preset: PeriodPreset, today: Date, retention: number): ResolvedPeriod {
  const tomorrow = addDays(today, 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  switch (preset) {
    case "today":
      return span(today, tomorrow);
    case "yesterday":
      return span(addDays(today, -1), today);
    case "7d":
      return span(addDays(today, -6), tomorrow);
    case "30d":
      return span(addDays(today, -29), tomorrow);
    case "month":
      return span(monthStart, tomorrow);
    case "last-month":
      return span(new Date(today.getFullYear(), today.getMonth() - 1, 1), monthStart);
    case "all":
      return span(addDays(today, -(retention - 1)), tomorrow);
  }
}

/**
 * Pins a period to local midnights as of `now`. A custom range is cut at tomorrow and at
 * `MAX_PERIOD_DAYS`; one left without a day once cut resolves as the default.
 */
export function resolvePeriod(
  period: Period,
  now: Date,
  retentionDays?: number | null,
): ResolvedPeriod {
  const today = startOfDay(now);
  const retention = keptDays(retentionDays);
  if (period.kind === "preset") return presetSpan(period.preset, today, retention);
  const first = parseDayKey(period.start);
  const last = parseDayKey(period.end);
  const tomorrow = addDays(today, 1);
  const end = last && addDays(last, 1) < tomorrow ? addDays(last, 1) : tomorrow;
  const floor = addDays(end, -MAX_PERIOD_DAYS);
  const start = first && first < floor ? floor : first;
  if (!start || start >= end) return presetSpan("7d", today, retention);
  return span(start, end);
}

/** The oldest local day worth picking: `retentionDays` back from today, today included. */
export const oldestDay = (now: Date, retentionDays?: number | null): string =>
  dayKey(addDays(startOfDay(now), -(keptDays(retentionDays) - 1)));

const monthName = new Intl.DateTimeFormat("en", { month: "short" });

function shortDate(date: Date, withYear: boolean): string {
  const text = `${date.getDate()} ${monthName.format(date)}`;
  return withYear ? `${text} ${date.getFullYear()}` : text;
}

/** `26 Sep – 2 Oct`, `2 Oct` for a single day, with years once the range leaves this one. */
export function rangeLabel(resolved: ResolvedPeriod, now: Date): string {
  const first = parseDayKey(resolved.firstDay) ?? resolved.start;
  const last = parseDayKey(resolved.lastDay) ?? resolved.start;
  const year = now.getFullYear();
  const withYear = first.getFullYear() !== year || last.getFullYear() !== year;
  if (resolved.firstDay === resolved.lastDay) return shortDate(first, withYear);
  return `${shortDate(first, withYear)} – ${shortDate(last, withYear)}`;
}

/** What the picker's button reads: the preset's name, or the dates of a custom range. */
export function periodLabel(period: Period, resolved: ResolvedPeriod, now: Date): string {
  if (period.kind === "custom") return rangeLabel(resolved, now);
  return PERIOD_PRESETS.find((preset) => preset.value === period.preset)?.label ?? "";
}

/**
 * `from`/`to` for an event query. "All kept history" sends neither, so the server answers with
 * whatever it still holds rather than a window guessed on the client.
 */
export function periodBounds(
  period: Period,
  resolved: ResolvedPeriod,
): { from: string | null; to: string | null } {
  if (period.kind === "preset" && period.preset === "all") return { from: null, to: null };
  return { from: resolved.start.toISOString(), to: resolved.end.toISOString() };
}

/** A custom period covering one local day. */
export const dayPeriod = (day: string): Period => ({ kind: "custom", start: day, end: day });
