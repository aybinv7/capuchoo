import { randomUUID } from "node:crypto";
import type { Arm } from "./arms.ts";
import { connectToWebView, type CdpSession } from "./cdp/session.ts";
import type { Adb } from "./device/adb.ts";
import type { App } from "./device/app.ts";
import { readConditions, waitForCool } from "./device/conditions.ts";
import { createInput, NotInForeground } from "./device/input.ts";
import { readCpuMs } from "./probes/cpu.ts";
import { readMemory } from "./probes/memory.ts";
import {
  readAppProbe,
  readObservations,
  readPageMetrics,
  startObserving,
  type AppProbe,
} from "./probes/page.ts";
import { startSampling } from "./probes/sampler.ts";
import type { RunRecord } from "./results.ts";
import type { PlannedRun } from "./schedule.ts";
import type { AppUnderTest, Profile, Scenario } from "./scenarios/types.ts";
import { createUi } from "./scenarios/ui.ts";

const ARM_KEY = "capuchoo.bench.arm";
const READY_TIMEOUT_MS = 60_000;
/** After the first screen: the policy request answers and startup work drains. */
const SETTLE_MS = 8000;

export interface RunnerOptions {
  adb: Adb;
  app: App;
  target: AppUnderTest;
  profile: Profile;
  maxTempC: number;
  log: (line: string) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attach(adb: Adb, app: App): Promise<{ page: CdpSession; appPid: number }> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const appPid = await app.mainPid();
    if (appPid) {
      try {
        const page = await connectToWebView(adb, appPid);
        await page.send("Performance.enable");
        return { page, appPid };
      } catch (error) {
        if (Date.now() > deadline) throw error;
      }
    } else if (Date.now() > deadline) {
      throw new Error("The app process never appeared");
    }
    await sleep(300);
  }
}

async function waitReady(page: CdpSession): Promise<AppProbe> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    const probe = await readAppProbe(page).catch(() => null);
    if (probe?.readyMs != null) return probe;
    if (Date.now() > deadline) throw new Error("The app never reported its first screen ready");
    await sleep(250);
  }
}

/**
 * Brings the app to the same state before every measured start: WebView storage cleared, one
 * launch to seed the database, set the arm and fetch the arm's policy, then stopped.
 */
export async function prepare(options: RunnerOptions, arm: Arm): Promise<void> {
  const { adb, app } = options;
  await app.clearWebViewData();
  await app.coldStart();
  const { page } = await attach(adb, app);
  try {
    await waitReady(page);
    await page.evaluate(
      `localStorage.setItem(${JSON.stringify(ARM_KEY)}, ${JSON.stringify(arm.local)})`,
    );
    await options.target.prepare({ page, ui: createUi(page, createInput(adb, app)) });
    await sleep(SETTLE_MS);
  } finally {
    await page.close();
  }
  await app.stop();
}

/** The device id the updater reports, which is what device-scoped recording rules target. */
export async function readDeviceId(options: RunnerOptions): Promise<string> {
  const { adb, app } = options;
  await app.coldStart();
  const { page } = await attach(adb, app);
  try {
    await waitReady(page);
    const result = await page.evaluate<{ deviceId?: string } | null>(
      "window.Capacitor?.Plugins?.CapacitorUpdater?.getDeviceId?.() ?? null",
    );
    if (!result?.deviceId) throw new Error("The updater reported no device id");
    return result.deviceId;
  } finally {
    await page.close();
    await app.stop();
  }
}

export async function measure(
  options: RunnerOptions,
  plan: PlannedRun,
  arm: Arm,
  scenario: Scenario,
): Promise<RunRecord> {
  const { adb, app, log } = options;
  const problems: string[] = [];
  const before = await waitForCool(adb, options.maxTempC, 10 * 60_000, log);
  if (before.batteryTempC !== null && before.batteryTempC > options.maxTempC) {
    problems.push(`started warm: ${before.batteryTempC}°C`);
  }

  await adb.shell("input keyevent KEYCODE_WAKEUP");
  const started = Date.now();
  const launch = await app.coldStart();
  const { page, appPid } = await attach(adb, app);
  const input = createInput(adb, app);
  const ui = createUi(page, input);

  try {
    const probe = await waitReady(page);
    await sleep(SETTLE_MS);
    await options.target.beforeMeasuring({ page, ui });
    const settledProbe = await readAppProbe(page);
    if (settledProbe.arm !== arm.local)
      problems.push(`arm is ${settledProbe.arm}, not ${arm.local}`);
    if (settledProbe.recorderMode !== arm.expectedMode) {
      problems.push(`recorder mode ${settledProbe.recorderMode}, expected ${arm.expectedMode}`);
    }

    const rendererPid = await app.rendererPid();
    if (rendererPid === null) problems.push("no WebView renderer process found");
    const settled = {
      app: await readMemory(adb, appPid),
      renderer: rendererPid === null ? null : await readMemory(adb, rendererPid),
    };
    const cpuBefore = {
      app: await readCpuMs(adb, appPid),
      renderer: rendererPid === null ? null : await readCpuMs(adb, rendererPid),
    };
    const pageBefore = await readPageMetrics(page).catch(() => null);
    await startObserving(page);
    const sampler = startSampling(
      adb,
      page,
      { app: appPid, renderer: rendererPid },
      scenario.sampleEveryMs,
    );

    const seconds = scenario.seconds[options.profile];
    try {
      await scenario.run({ page, ui, seconds, log });
    } catch (error) {
      if (error instanceof NotInForeground) throw error;
      problems.push(`scenario failed: ${(error as Error).message}`);
    }

    const series = await sampler.stop();
    const observations = await readObservations(page).catch(() => null);
    const pageAfter = await readPageMetrics(page).catch(() => null);
    const cpuAfter = {
      app: await readCpuMs(adb, appPid),
      renderer: rendererPid === null ? null : await readCpuMs(adb, rendererPid),
    };
    const end = {
      app: await readMemory(adb, appPid),
      renderer: rendererPid === null ? null : await readMemory(adb, rendererPid),
    };
    const finalProbe = await readAppProbe(page).catch(() => null);
    if ((await app.mainPid()) !== appPid) problems.push("the app restarted mid-run");

    const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);
    return {
      runId: randomUUID(),
      rep: plan.rep,
      warmup: plan.warmup,
      arm: arm.name,
      scenario: scenario.name,
      startedAt: new Date(started).toISOString(),
      durationS: Math.round((Date.now() - started) / 100) / 10,
      valid: problems.length === 0,
      problems,
      conditions: { before, after: await readConditions(adb).catch(() => null) },
      launch,
      readyMs: probe.readyMs,
      armSeen: settledProbe.arm,
      recorderMode: settledProbe.recorderMode,
      cpuMs: {
        app: delta(cpuBefore.app, cpuAfter.app),
        renderer: delta(cpuBefore.renderer, cpuAfter.renderer),
      },
      memory: { settled, end, series },
      page: { before: pageBefore, after: pageAfter, observations },
      storageBytes: { before: settledProbe.storageBytes, after: finalProbe?.storageBytes ?? null },
    };
  } finally {
    await page.close().catch(() => undefined);
    await app.stop().catch(() => undefined);
  }
}
