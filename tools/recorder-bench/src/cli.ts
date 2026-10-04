import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARMS, applyArmRule } from "./arms.ts";
import { loadConfig } from "./config.ts";
import { connectedDevices, createAdb } from "./device/adb.ts";
import { createApp } from "./device/app.ts";
import { readScreenSettings } from "./device/conditions.ts";
import { NotInForeground } from "./device/input.ts";
import { openResults } from "./results.ts";
import { measure, prepare, readDeviceId, type RunnerOptions } from "./runner.ts";
import { planRuns, WARMUP_SCENARIO } from "./schedule.ts";
import { TESTBED } from "./scenarios/testbed.ts";
import { createMcpClient } from "./server/mcp.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const log = (line: string) =>
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${line}
`);

/** Prepare, cold start and measuring overhead per run, measured on the Redmi; used for the estimate. */
const OVERHEAD_S = 45;

async function main() {
  const config = await loadConfig(process.argv.slice(2), root);
  const target = TESTBED;
  const scenarios = config.scenarios
    ? config.scenarios.map((name) => {
        const found = target.scenarios.find((scenario) => scenario.name === name);
        if (!found) throw new Error(`Unknown scenario "${name}"`);
        return found;
      })
    : target.scenarios.filter((scenario) => scenario.name !== "soak");

  const scenarioOf = (name: string) =>
    target.scenarios.find((scenario) => scenario.name === name) ??
    target.scenarios.find((scenario) => scenario.name === WARMUP_SCENARIO)!;
  const plan = planRuns({
    arms: config.arms,
    scenarios: scenarios.map((scenario) => scenario.name),
    reps: config.reps,
    warmup: config.warmup,
    seed: config.seed,
  });
  const seconds = plan.reduce(
    (total, run) => total + OVERHEAD_S + scenarioOf(run.scenario).seconds[config.profile],
    0,
  );
  log(
    `${plan.length} runs, ${scenarios.length} scenarios × ${config.arms.length} arms × ${config.reps} reps${config.warmup ? ` + ${config.arms.length} warm-up starts` : ""}, about ${Math.round(seconds / 60)} min (seed ${config.seed})`,
  );
  if (config.dryRun) {
    for (const run of plan)
      log(`  rep ${run.rep}${run.warmup ? " (warm-up)" : ""}  ${run.scenario}  ${run.arm}`);
    return;
  }

  const devices = await connectedDevices();
  const serial = config.serial ?? (devices.length === 1 ? devices[0]! : null);
  if (!serial || !devices.includes(serial)) {
    throw new Error(`Pick a device with --serial; connected: ${devices.join(", ") || "none"}`);
  }
  const needsRules = config.arms.some((arm) => arm !== "absent");
  if (needsRules && (!config.apiKey || !config.capuchooApp)) {
    throw new Error(
      "Arms other than absent switch the device's recording rule: set CAPUCHOO_BENCH_KEY and CAPUCHOO_BENCH_APP in tools/recorder-bench/.env.local",
    );
  }

  const adb = createAdb(serial);
  const app = createApp(adb, config.packageName ?? target.packageName);
  const screen = await readScreenSettings(adb);
  if ((screen.screenOffTimeoutMs ?? 0) < 10 * 60_000 && !screen.stayOnWhilePlugged) {
    throw new Error(
      "The screen would turn off mid-run. Turn on Developer options > Stay awake, or set the screen timeout to 10 minutes or more.",
    );
  }

  const options: RunnerOptions = {
    adb,
    app,
    target,
    profile: config.profile,
    maxTempC: config.maxTempC,
    log,
  };
  const deviceId = await readDeviceId(options);
  const mcp = needsRules ? createMcpClient(config.mcpEndpoint, config.apiKey!) : null;
  const ruleTarget = { app: config.capuchooApp ?? "", deviceId };

  const results = await openResults(config.outDir, {
    serial,
    app: target.name,
    packageName: app.packageName,
    deviceId,
    profile: config.profile,
    reps: config.reps,
    warmup: config.warmup,
    seed: config.seed,
    arms: config.arms,
    scenarios: scenarios.map((scenario) => scenario.name),
    maxTempC: config.maxTempC,
    startedAt: new Date().toISOString(),
  });
  log(`results in ${results.directory}`);

  let ruled: string | null = null;
  try {
    for (const [index, run] of plan.entries()) {
      const arm = ARMS[run.arm];
      const scenario = scenarioOf(run.scenario);
      const rule = JSON.stringify(arm.policy);
      if (mcp && rule !== ruled) {
        await applyArmRule(mcp, ruleTarget, arm);
        ruled = rule;
      }
      log(
        `${index + 1}/${plan.length}  ${run.scenario}  ${run.arm}${run.warmup ? "  (warm-up)" : ""}`,
      );
      await prepare(options, arm);
      const record = await measure(options, run, arm, scenario);
      await results.append(record);
      if (!record.valid) log(`   invalid: ${record.problems.join("; ")}`);
    }
  } catch (error) {
    if (error instanceof NotInForeground) {
      log("Stopped: the app left the foreground. Runs so far are saved; rerun to continue.");
    } else {
      throw error;
    }
  } finally {
    if (mcp) {
      await mcp
        .call("set_recording_rule", {
          app: ruleTarget.app,
          scope: "device",
          target: deviceId,
          policy: {},
        })
        .then(() => log("device rule cleared"))
        .catch((error: Error) => log(`could not clear the device rule: ${error.message}`));
    }
    await app.stop().catch(() => undefined);
  }
  log(`done. Summarise with: pnpm --filter @capuchoo/recorder-bench report ${results.directory}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
