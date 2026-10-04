import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ArmName } from "./arms.ts";
import type { LaunchTiming } from "./device/app.ts";
import type { DeviceConditions } from "./device/conditions.ts";
import type { ProcessMemory } from "./probes/memory.ts";
import type { PageMetrics, PageObservations } from "./probes/page.ts";
import type { MemoryPoint } from "./probes/sampler.ts";

export interface RunRecord {
  runId: string;
  rep: number;
  /** The first repetition warms caches and the JIT; it is recorded but left out of the comparison. */
  warmup: boolean;
  arm: ArmName;
  scenario: string;
  startedAt: string;
  durationS: number;
  valid: boolean;
  problems: string[];
  conditions: { before: DeviceConditions; after: DeviceConditions | null };
  launch: LaunchTiming;
  /** Time from navigation start to the first screen being mounted and painted. */
  readyMs: number | null;
  armSeen: string | null;
  recorderMode: string | null;
  cpuMs: { app: number | null; renderer: number | null };
  memory: {
    settled: { app: ProcessMemory | null; renderer: ProcessMemory | null };
    end: { app: ProcessMemory | null; renderer: ProcessMemory | null };
    series: MemoryPoint[];
  };
  page: {
    before: PageMetrics | null;
    after: PageMetrics | null;
    observations: PageObservations | null;
  };
  storageBytes: { before: number | null; after: number | null };
}

/** One JSON line per run, appended as each finishes, so a crash or an abort loses nothing. */
export async function openResults(directory: string, meta: Record<string, unknown>) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  const file = join(directory, "runs.jsonl");
  return {
    directory,
    async append(record: RunRecord) {
      await appendFile(file, `${JSON.stringify(record)}\n`);
    },
  };
}
