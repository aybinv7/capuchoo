import type { Artefact } from "../types/release";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en");
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
const clock = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const shortClock = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit]}`;
}

export function formatCount(value: number | null | undefined, exact = false): string {
  if (value === null || value === undefined) return "—";
  return exact || Math.abs(value) < 10_000 ? whole.format(value) : compact.format(value);
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return percent.format(ratio);
}

/** `part / total`, or null when there is nothing to divide. */
export function ratio(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

/** Time of day, `14:32:05`, or `14:32` when `seconds` is false. */
export function formatClock(value: string | null | undefined, seconds = true): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return (seconds ? clock : shortClock).format(date);
}

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

export function formatRelative(value: string | null | undefined, now: number): string {
  if (!value) return "never";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "—";
  let delta = (time - now) / 1000;
  if (Math.abs(delta) < 5) return "just now";
  for (const [unit, size] of STEPS) {
    if (Math.abs(delta) < size) return relative.format(Math.round(delta), unit);
    delta /= size;
  }
  return relative.format(Math.round(delta), "year");
}

/** Elapsed time between two instants, `1m 12s` style. */
export function formatDuration(from: string | null, to: string | null, now: number): string {
  if (!from) return "—";
  const end = to ? new Date(to).getTime() : now;
  const seconds = Math.max(0, Math.round((end - new Date(from).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function shortId(value: string | null | undefined, length = 8): string {
  return value ? value.slice(0, length) : "—";
}

/** `1.4.2` for a bundle, `1.4.2 (42)` for a native build. */
export function artefactLabel(artefact: Artefact): string {
  return artefact.kind === "native"
    ? `${artefact.version_name} (${artefact.version_code})`
    : artefact.version_name;
}
