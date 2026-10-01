const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`;
}

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "3 minutes ago", "yesterday" - in the reader's language, from an ISO timestamp. */
export function formatRelative(
  iso: string | null | undefined,
  locale: string,
  now = Date.now(),
): string {
  if (!iso) return "—";
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let value = (Date.parse(iso) - now) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return formatter.format(Math.round(value), unit);
    value /= size;
  }
  return formatter.format(Math.round(value), "year");
}

/** The day heading an activity row sits under: "Today", "Yesterday", or a date. */
export function formatDay(iso: string, locale: string, now = new Date()): string {
  const date = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 1)
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-days, "day");
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

export function versionLabel(
  name: string | null | undefined,
  code: number | null | undefined,
): string {
  if (!name) return "—";
  return code === null || code === undefined ? name : `${name} (${code})`;
}

export function parseChannels(json: string | null | undefined): string[] {
  try {
    const value: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
