import type { Adb } from "../device/adb.ts";

/** Linux clock ticks per second; 100 on every Android kernel the harness targets. */
const TICKS_PER_SECOND = 100;

/**
 * CPU time a process has used so far, user plus system, in milliseconds. Read before and after a
 * scenario; the difference is what the scenario cost that process, whatever the screen showed.
 */
export async function readCpuMs(adb: Adb, pid: number): Promise<number | null> {
  const stat = await adb.shell(`cat /proc/${pid}/stat`).catch(() => "");
  return parseCpuMs(stat);
}

export function parseCpuMs(stat: string): number | null {
  const afterName = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  const utime = Number(afterName[11]);
  const stime = Number(afterName[12]);
  if (!Number.isFinite(utime) || !Number.isFinite(stime)) return null;
  return ((utime + stime) * 1000) / TICKS_PER_SECOND;
}
