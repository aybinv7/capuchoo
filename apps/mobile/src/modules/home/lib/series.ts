import type { DailyActivity, VersionShare } from "@/shared/api/types";

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

export interface VersionSlice {
  version: string;
  devices: number;
  share: number;
}

/** Devices per version across platforms, largest first; the tail beyond `limit` folds into one. */
export function versionSlices(
  versions: readonly VersionShare[],
  limit: number,
  otherLabel: (count: number) => string,
): VersionSlice[] {
  const merged = new Map<string, number>();
  for (const row of versions) merged.set(row.version, (merged.get(row.version) ?? 0) + row.devices);
  const sorted = [...merged.entries()]
    .map(([version, devices]) => ({ version, devices }))
    .sort((a, b) => b.devices - a.devices);
  const total = sorted.reduce((sum, entry) => sum + entry.devices, 0) || 1;
  const kept =
    sorted.length <= limit
      ? sorted
      : [
          ...sorted.slice(0, limit - 1),
          {
            version: otherLabel(sorted.length - limit + 1),
            devices: sorted.slice(limit - 1).reduce((sum, entry) => sum + entry.devices, 0),
          },
        ];
  return kept.map((entry) => ({ ...entry, share: entry.devices / total }));
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}
