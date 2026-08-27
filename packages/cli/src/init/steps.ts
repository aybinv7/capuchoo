/**
 * The steps `init` performs after the app is linked.
 *
 * Each one reports rather than throws: a step that could not finish should not
 * hide the ones after it, and the run ends with a table saying exactly what
 * happened. `verify` is what turns that into a verdict.
 *
 * The writes are deliberate and confirmed. `pipeline/wiring.ts` decides *what*
 * a file should contain; these functions own showing it and asking.
 */

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import type { Environment, ResolvedProjectConfig } from "@capuchoo/core";
import { confirm, log } from "../cli/prompts.js";
import type { InitStepId } from "../cli/init-plan.js";
import {
  applyInstall,
  nothingToInstall,
  planInstall,
  type InstallPlan,
} from "../pipeline/install.js";
import {
  describePatch,
  patchCapacitorConfig,
  patchEntryFile,
  patchEnvFile,
} from "../pipeline/wiring.js";
import type { CloudClient } from "../services/cloud.js";

export type StepState = "applied" | "satisfied" | "skipped" | "failed";

export interface StepOutcome {
  id: InitStepId;
  state: StepState;
  detail: string;
}

export interface StepContext {
  appDir: string;
  project: ResolvedProjectConfig;
  endpoint: string;
  cloud: CloudClient;
  cloudAppId: string;
  bundleId: string;
  /** Whether prompts may be asked. */
  interactive: boolean;
  /** Apply every patch without asking. */
  assumeYes: boolean;
  /** Report what would change and write nothing. */
  dryRun: boolean;
  cliVersion: string;
  native: boolean;
  /** @capacitor/device, for update telemetry. */
  telemetry: boolean;
  /** Run cap sync after installing. Native code reaches the platforms only there. */
  sync: boolean;
}

/** Entry files worth looking in, most conventional first. */
const ENTRY_CANDIDATES = [
  "src/main.ts",
  "src/main.js",
  "src/index.ts",
  "src/index.js",
  "src/main.tsx",
  "src/app.ts",
];

const CONFIG_CANDIDATES = ["capacitor.config.ts", "capacitor.config.js"];

function firstExisting(appDir: string, candidates: string[]): string | null {
  return candidates.find((name) => fs.existsSync(path.join(appDir, name))) ?? null;
}

export function findEntryFile(appDir: string): string | null {
  return firstExisting(appDir, ENTRY_CANDIDATES);
}

export function findCapacitorConfig(appDir: string): string | null {
  return firstExisting(appDir, CONFIG_CANDIDATES);
}

/**
 * Registers the app's own bundle identifier.
 *
 * Shared - claiming no flavour - because that is what a single-identifier app is,
 * and it is the majority. An app that suffixes per flavour registers those
 * explicitly with `capuchoo app identifiers add`, and guessing from the spelling
 * is what this whole model replaced.
 */
export async function stepIdentifiers(ctx: StepContext): Promise<StepOutcome> {
  const id: InitStepId = "identifiers";

  try {
    const existing = await ctx.cloud.identifiers(ctx.cloudAppId);

    if (existing.some((row) => row.bundle_id === ctx.bundleId)) {
      return { id, state: "satisfied", detail: `${ctx.bundleId} is registered` };
    }

    if (ctx.dryRun) {
      return { id, state: "skipped", detail: `would register ${ctx.bundleId}` };
    }

    await ctx.cloud.registerIdentifier(ctx.cloudAppId, {
      bundle_id: ctx.bundleId,
      platform: "all",
    });

    return { id, state: "applied", detail: `${ctx.bundleId}, every flavour` };
  } catch (error) {
    // An older backend has no such endpoint, and resolution falls back to the
    // app's own id, so this is not fatal.
    return {
      id,
      state: "skipped",
      detail: `could not register: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function stepPackages(ctx: StepContext): Promise<StepOutcome> {
  const id: InitStepId = "packages";
  const plan: InstallPlan = planInstall(ctx.appDir, {
    native: ctx.native,
    telemetry: ctx.telemetry,
    cliVersion: ctx.cliVersion,
  });

  if (plan.refusal) return { id, state: "failed", detail: plan.refusal };
  if (nothingToInstall(plan)) {
    return { id, state: "satisfied", detail: `Capacitor ${plan.capacitorMajor}, all present` };
  }

  const names = [...plan.missing.map((p) => p.name), ...(plan.missingCli ? ["@capuchoo/cli"] : [])];

  if (ctx.dryRun) return { id, state: "skipped", detail: `would install ${names.join(", ")}` };

  if (ctx.interactive && !ctx.assumeYes) {
    log.info(`Install ${names.join(", ")}?`);
    if (!(await confirm("Install these?", { default: true }))) {
      return { id, state: "skipped", detail: "declined" };
    }
  }

  await applyInstall(ctx.appDir, plan, { verbose: true, sync: ctx.sync });

  return { id, state: "applied", detail: names.join(", ") };
}

/**
 * Gives every flavour an update URL and a channel.
 *
 * This is the step that did not exist, and its absence is why three separate
 * first runs ended at `deploy` being refused. The channel written is the
 * flavour's own name, which is the convention the rest of the CLI assumes.
 */
export async function stepEnv(ctx: StepContext): Promise<StepOutcome> {
  const id: InitStepId = "env";
  const applied: string[] = [];
  const conflicts: string[] = [];
  let satisfied = 0;

  for (const [environment, flavour] of Object.entries(ctx.project.flavours)) {
    const file = path.join(ctx.appDir, flavour.envFile);
    if (!fs.existsSync(file)) continue;

    const before = fs.readFileSync(file, "utf8");
    const patch = patchEnvFile(before, ctx.endpoint, environment as Environment);

    if (patch.conflict) conflicts.push(`${flavour.envFile}: ${patch.conflict}`);

    if (patch.content === null) {
      satisfied += 1;
      continue;
    }

    if (ctx.dryRun) {
      log.info(describePatch(flavour.envFile, before, patch.content));
      continue;
    }

    if (ctx.interactive && !ctx.assumeYes) {
      log.info(describePatch(flavour.envFile, before, patch.content));
      if (!(await confirm(`Write ${flavour.envFile}?`, { default: true }))) continue;
    }

    fs.writeFileSync(file, patch.content, "utf8");
    applied.push(flavour.envFile);
  }

  for (const conflict of conflicts) {
    // Reported, never overwritten: a different endpoint may be deliberate, and
    // Lowmaro's was a stale host that would have failed silently either way.
    log.warn(`${conflict} - left as it is`);
  }

  if (applied.length === 0) {
    return {
      id,
      state: satisfied > 0 ? "satisfied" : "skipped",
      detail: satisfied > 0 ? `${satisfied} flavours already set` : "nothing written",
    };
  }

  return { id, state: "applied", detail: applied.join(", ") };
}

/** notifyAppReady() in the entry file, and the plugin block in the config. */
export async function stepCode(ctx: StepContext): Promise<StepOutcome> {
  const id: InitStepId = "code";
  const targets: Array<{ file: string | null; patch: typeof patchEntryFile }> = [
    { file: findEntryFile(ctx.appDir), patch: patchEntryFile },
    { file: findCapacitorConfig(ctx.appDir), patch: patchCapacitorConfig },
  ];

  const applied: string[] = [];
  const manual: string[] = [];
  let satisfied = 0;

  for (const { file, patch: patcher } of targets) {
    if (!file) {
      manual.push("could not find the file to edit");
      continue;
    }

    const full = path.join(ctx.appDir, file);
    const before = fs.readFileSync(full, "utf8");
    const patch = patcher(before);

    if (patch.manual) {
      manual.push(`${file}: ${patch.summary}`);
      log.warn(`${file} - ${patch.summary}. Add this by hand:\n${patch.manual}`);
      continue;
    }

    if (patch.content === null) {
      satisfied += 1;
      continue;
    }

    if (ctx.dryRun) {
      log.info(describePatch(file, before, patch.content));
      continue;
    }

    if (ctx.interactive && !ctx.assumeYes) {
      log.info(describePatch(file, before, patch.content));
      if (!(await confirm(`Write ${file}?`, { default: true }))) continue;
    }

    fs.writeFileSync(full, patch.content, "utf8");
    applied.push(file);
  }

  if (applied.length === 0) {
    if (manual.length > 0) return { id, state: "skipped", detail: manual.join("; ") };
    return {
      id,
      state: satisfied > 0 ? "satisfied" : "skipped",
      detail: satisfied > 0 ? "already wired" : "nothing written",
    };
  }

  const detail =
    manual.length > 0 ? `${applied.join(", ")} (${manual.length} by hand)` : applied.join(", ");

  return { id, state: "applied", detail };
}

/** One line per step, aligned, so the run reads as a report and not a log. */
export function renderOutcomes(outcomes: StepOutcome[]): string {
  const mark: Record<StepState, string> = {
    applied: chalk.green("applied"),
    satisfied: chalk.dim("done"),
    skipped: chalk.yellow("skipped"),
    failed: chalk.red("failed"),
  };
  const width = Math.max(...outcomes.map((outcome) => outcome.id.length));

  return outcomes
    .map(
      (outcome) =>
        `  ${outcome.id.padEnd(width)}  ${mark[outcome.state]}  ${chalk.dim(outcome.detail)}`,
    )
    .join("\n");
}
