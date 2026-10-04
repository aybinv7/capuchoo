import { fillDays as fillWindow } from "@/shared/lib/days";
import type { DailyActivity, VersionShare } from "@/shared/types/stats";

/** One row per day of the window, oldest first; days the server did not report are zero. */
export function fillDays(
  daily: readonly DailyActivity[],
  days: number,
  now: number,
): DailyActivity[] {
  return fillWindow(daily, days, now, (day) => ({
    day,
    checks: 0,
    installs: 0,
    failures: 0,
    devices: 0,
  }));
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
