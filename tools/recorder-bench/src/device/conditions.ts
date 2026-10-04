import type { Adb } from "./adb.ts";

export interface DeviceConditions {
  batteryLevel: number | null;
  /** Battery temperature in °C, the best signal a phone gives for how warm it runs. */
  batteryTempC: number | null;
  charging: boolean | null;
  /** Android's thermal status: 0 none, 1 light, 2 moderate, 3 severe and above. */
  thermalStatus: number | null;
  screenOn: boolean | null;
}

const numberAfter = (output: string, label: string) => {
  const match = new RegExp(`${label}:\\s*(-?\\d+)`).exec(output);
  return match ? Number(match[1]) : null;
};

/** What could skew a run: heat, charge and the screen. Recorded before and after every run. */
export async function readConditions(adb: Adb): Promise<DeviceConditions> {
  const [battery, thermal, power] = await Promise.all([
    adb.shell("dumpsys battery").catch(() => ""),
    adb.shell("dumpsys thermalservice").catch(() => ""),
    adb.shell("dumpsys power | grep -E 'mWakefulness=|Display Power'").catch(() => ""),
  ]);
  const temperature = numberAfter(battery, "temperature");
  const plugged = /(AC|USB|Wireless) powered:\s*true/.test(battery);
  return {
    batteryLevel: numberAfter(battery, "level"),
    batteryTempC: temperature === null ? null : temperature / 10,
    charging: battery ? plugged : null,
    thermalStatus: numberAfter(thermal, "Thermal Status"),
    screenOn: power ? /mWakefulness=Awake/.test(power) : null,
  };
}

/** Settings the harness only reads; changing them is left to the device's owner. */
export async function readScreenSettings(
  adb: Adb,
): Promise<{ screenOffTimeoutMs: number | null; stayOnWhilePlugged: number | null }> {
  const [timeout, stayOn] = await Promise.all([
    adb.shell("settings get system screen_off_timeout").catch(() => ""),
    adb.shell("settings get global stay_on_while_plugged_in").catch(() => ""),
  ]);
  const parse = (value: string) => {
    const number = Number(value.trim());
    return Number.isFinite(number) ? number : null;
  };
  return { screenOffTimeoutMs: parse(timeout), stayOnWhilePlugged: parse(stayOn) };
}

/**
 * Waits until the phone has cooled to `maxTempC` and its thermal status is back to none or light,
 * so a run never starts on a throttled CPU. Gives up after `maxWaitMs` and says so.
 */
export async function waitForCool(
  adb: Adb,
  maxTempC: number,
  maxWaitMs: number,
  log: (line: string) => void,
): Promise<DeviceConditions> {
  const started = Date.now();
  for (;;) {
    const conditions = await readConditions(adb);
    const cool =
      (conditions.batteryTempC === null || conditions.batteryTempC <= maxTempC) &&
      (conditions.thermalStatus === null || conditions.thermalStatus <= 1);
    if (cool || Date.now() - started > maxWaitMs) return conditions;
    log(`cooling: ${conditions.batteryTempC}°C, thermal ${conditions.thermalStatus}`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}
