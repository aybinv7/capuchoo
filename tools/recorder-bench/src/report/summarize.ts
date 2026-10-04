import { ARM_NAMES, type ArmName } from "../arms.ts";
import type { RunRecord } from "../results.ts";
import { METRICS } from "./metrics.ts";
import { compare, spread, type Difference, type Spread } from "./stats.ts";

export interface MetricRow {
  key: string;
  label: string;
  unit: string;
  arms: Partial<Record<ArmName, Spread>>;
  /** Each arm against `absent`, the build that never loads the recorder. */
  versusAbsent: Partial<Record<ArmName, Difference | null>>;
}

export interface ScenarioSummary {
  scenario: string;
  runs: Partial<Record<ArmName, number>>;
  rows: MetricRow[];
}

export interface Summary {
  totalRuns: number;
  comparedRuns: number;
  excluded: Array<{ runId: string; arm: string; scenario: string; reason: string }>;
  scenarios: ScenarioSummary[];
}

/** Valid, non-warm-up runs only; everything left out is listed with why, never dropped silently. */
export function summarize(runs: readonly RunRecord[]): Summary {
  const excluded: Summary["excluded"] = [];
  const kept = runs.filter((run) => {
    if (run.warmup) return false;
    if (!run.valid) {
      excluded.push({
        runId: run.runId,
        arm: run.arm,
        scenario: run.scenario,
        reason: run.problems.join("; "),
      });
      return false;
    }
    return true;
  });

  const scenarioNames = [...new Set(kept.map((run) => run.scenario))];
  const scenarios = scenarioNames.map((scenario): ScenarioSummary => {
    const inScenario = kept.filter((run) => run.scenario === scenario);
    const arms = ARM_NAMES.filter((arm) => inScenario.some((run) => run.arm === arm));
    const valuesOf = (arm: ArmName, read: (run: RunRecord) => number | null) =>
      inScenario
        .filter((run) => run.arm === arm)
        .map(read)
        .filter((value): value is number => value !== null && Number.isFinite(value));

    const rows = METRICS.map((metric): MetricRow => {
      const row: MetricRow = {
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        arms: {},
        versusAbsent: {},
      };
      const baseline = valuesOf("absent", metric.read);
      for (const arm of arms) {
        const values = valuesOf(arm, metric.read);
        if (values.length) row.arms[arm] = spread(values);
        if (arm !== "absent" && baseline.length) row.versusAbsent[arm] = compare(baseline, values);
      }
      return row;
    }).filter((row) => Object.keys(row.arms).length > 0);

    return {
      scenario,
      runs: Object.fromEntries(
        arms.map((arm) => [arm, inScenario.filter((run) => run.arm === arm).length]),
      ),
      rows,
    };
  });

  return { totalRuns: runs.length, comparedRuns: kept.length, excluded, scenarios };
}

const number = (value: number) =>
  Math.abs(value) >= 100
    ? value.toFixed(0)
    : Math.abs(value) >= 10
      ? value.toFixed(1)
      : value.toFixed(2);

/** A Markdown digest: per scenario, each metric's median per arm and its change against absent. */
export function toMarkdown(summary: Summary): string {
  const lines = [
    `# Recorder cost`,
    "",
    `${summary.comparedRuns} runs compared (${summary.totalRuns} recorded, warm-ups and invalid runs left out).`,
    "Each cell: median (25th–75th percentile). Against absent: change of the median, 95% interval; **bold** when the interval excludes zero.",
    "",
  ];
  for (const scenario of summary.scenarios) {
    const arms = ARM_NAMES.filter((arm) => scenario.runs[arm]);
    lines.push(`## ${scenario.scenario}`, "");
    lines.push(`| Metric | ${arms.map((arm) => `${arm} (n=${scenario.runs[arm]})`).join(" | ")} |`);
    lines.push(`|---|${arms.map(() => "---").join("|")}|`);
    for (const row of scenario.rows) {
      const cells = arms.map((arm) => {
        const value = row.arms[arm];
        if (!value) return "–";
        const cell = `${number(value.median)} (${number(value.p25)}–${number(value.p75)})`;
        const difference = row.versusAbsent[arm];
        if (!difference) return cell;
        const change = `${difference.delta >= 0 ? "+" : ""}${number(difference.delta)} [${number(difference.low)}, ${number(difference.high)}]`;
        return `${cell}<br>${difference.clear ? `**${change}**` : change}`;
      });
      lines.push(`| ${row.label} (${row.unit}) | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  if (summary.excluded.length) {
    lines.push("## Left out", "");
    for (const run of summary.excluded) lines.push(`- ${run.scenario} / ${run.arm}: ${run.reason}`);
  }
  return `${lines.join("\n")}\n`;
}
