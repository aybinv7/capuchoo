import type { Adb } from "../device/adb.ts";

/** One process's memory as Android accounts it, in KiB. */
export interface ProcessMemory {
  totalPss: number;
  totalRss: number | null;
  javaHeap: number | null;
  nativeHeap: number | null;
  code: number | null;
  graphics: number | null;
  privateOther: number | null;
  system: number | null;
}

const summary = (output: string, label: string) => {
  const match = new RegExp(`^\\s*${label}:\\s+(\\d+)`, "m").exec(output);
  return match ? Number(match[1]) : null;
};

/** Parses the App Summary of `dumpsys meminfo`, which is stable across Android 10 to 16. */
export function parseMeminfo(output: string): ProcessMemory | null {
  const table = /^\s*TOTAL\s+(\d+)/m.exec(output);
  const totalPss = summary(output, "TOTAL PSS") ?? (table ? Number(table[1]) : null);
  if (totalPss === null) return null;
  return {
    totalPss,
    totalRss: summary(output, "TOTAL RSS"),
    javaHeap: summary(output, "Java Heap"),
    nativeHeap: summary(output, "Native Heap"),
    code: summary(output, "Code"),
    graphics: summary(output, "Graphics"),
    privateOther: summary(output, "Private Other"),
    system: summary(output, "System"),
  };
}

export async function readMemory(adb: Adb, pid: number): Promise<ProcessMemory | null> {
  const output = await adb.shell(`dumpsys meminfo ${pid}`, 30_000).catch(() => "");
  return parseMeminfo(output);
}
