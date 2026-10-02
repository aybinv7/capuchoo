import type { DailyActivity, VersionShare } from "@/shared/types/stats";

const DAY_MS = 86_400_000;

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** One row per day of the window, oldest first; days the server did not report are zero. */
export function fillDays(
  daily: readonly DailyActivity[],
  days: number,
  now: number,
): DailyActivity[] {
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const today = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const rows: DailyActivity[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = isoDay(today - offset * DAY_MS);
    rows.push(byDay.get(day) ?? { day, checks: 0, installs: 0, failures: 0, devices: 0 });
  }
  return rows;
}

export interface VersionBar {
  version: string;
  devices: number;
  platforms: string[];
}

/** Devices per version across platforms, largest first; the tail beyond `limit` folds into "other". */
export function versionBars(versions: readonly VersionShare[], limit = 10): VersionBar[] {
  const merged = new Map<string, VersionBar>();
  for (const row of versions) {
    const entry = merged.get(row.version) ?? { version: row.version, devices: 0, platforms: [] };
    entry.devices += row.devices;
    if (!entry.platforms.includes(row.platform)) entry.platforms.push(row.platform);
    merged.set(row.version, entry);
  }
  const sorted = [...merged.values()].sort((a, b) => b.devices - a.devices);
  if (sorted.length <= limit) return sorted;
  const tail = sorted.slice(limit - 1);
  return [
    ...sorted.slice(0, limit - 1),
    {
      version: `${tail.length} others`,
      devices: tail.reduce((sum, entry) => sum + entry.devices, 0),
      platforms: [...new Set(tail.flatMap((entry) => entry.platforms))],
    },
  ];
}
