import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { ARM_NAMES, parseArms, type ArmName } from "./arms.ts";
import type { Profile } from "./scenarios/types.ts";

export interface BenchConfig {
  serial: string | null;
  /** Overrides the app's own package name, for a differently suffixed build. */
  packageName: string | null;
  scenarios: string[] | null;
  arms: ArmName[];
  reps: number;
  warmup: boolean;
  profile: Profile;
  seed: number;
  maxTempC: number;
  outDir: string;
  dryRun: boolean;
  /** Capuchoo app (id or bundle identifier) whose device rules the arms switch. */
  capuchooApp: string | null;
  mcpEndpoint: string;
  /** From the environment only; never written to results. */
  apiKey: string | null;
}

const PROFILES: Profile[] = ["quick", "standard", "soak"];

/** KEY=value lines from `.env.local` next to the package, so the key never goes on a command line. */
async function readEnvFile(root: string): Promise<Record<string, string>> {
  const text = await readFile(join(root, ".env.local"), "utf8").catch(() => "");
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
  return values;
}

export async function loadConfig(argv: string[], root: string): Promise<BenchConfig> {
  const { values } = parseArgs({
    args: argv,
    options: {
      serial: { type: "string" },
      package: { type: "string" },
      scenarios: { type: "string" },
      arms: { type: "string", default: ARM_NAMES.join(",") },
      reps: { type: "string", default: "5" },
      "no-warmup": { type: "boolean", default: false },
      profile: { type: "string", default: "standard" },
      seed: { type: "string" },
      "max-temp": { type: "string", default: "38" },
      out: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const env = { ...(await readEnvFile(root)), ...process.env };
  const profile = values.profile as Profile;
  if (!PROFILES.includes(profile))
    throw new Error(`--profile must be one of ${PROFILES.join(", ")}`);
  const reps = Number(values.reps);
  if (!Number.isInteger(reps) || reps < 1) throw new Error("--reps must be a positive integer");
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);

  return {
    serial: values.serial ?? null,
    packageName: values.package ?? null,
    scenarios: values.scenarios ? values.scenarios.split(",").map((name) => name.trim()) : null,
    arms: parseArms(values.arms!),
    reps,
    warmup: !values["no-warmup"],
    profile,
    seed: values.seed ? Number(values.seed) : Date.now() % 2_147_483_647,
    maxTempC: Number(values["max-temp"]),
    outDir: values.out ?? join(root, "results", stamp),
    dryRun: values["dry-run"] ?? false,
    capuchooApp: env.CAPUCHOO_BENCH_APP ?? null,
    mcpEndpoint: env.CAPUCHOO_BENCH_MCP ?? "https://capuchoo-dashboard.onrender.com/api/mcp",
    apiKey: env.CAPUCHOO_BENCH_KEY ?? null,
  };
}
