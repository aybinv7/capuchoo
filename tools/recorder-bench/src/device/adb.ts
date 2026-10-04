import { execFile } from "node:child_process";

const TIMEOUT_MS = 60_000;
const MAX_OUTPUT = 32 * 1024 * 1024;

export interface Adb {
  readonly serial: string;
  run(args: readonly string[], timeoutMs?: number): Promise<string>;
  shell(command: string, timeoutMs?: number): Promise<string>;
}

/** One device, addressed by serial on every call so a second phone or emulator is never hit. */
export function createAdb(serial: string): Adb {
  const run = (args: readonly string[], timeoutMs = TIMEOUT_MS) =>
    new Promise<string>((resolve, reject) => {
      execFile(
        "adb",
        ["-s", serial, ...args],
        { timeout: timeoutMs, maxBuffer: MAX_OUTPUT, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`adb ${args.join(" ")} failed: ${stderr.trim() || error.message}`));
            return;
          }
          resolve(stdout);
        },
      );
    });
  return {
    serial,
    run,
    shell: (command, timeoutMs) => run(["shell", command], timeoutMs),
  };
}

/** Serials adb sees in the `device` state, so the CLI can refuse an ambiguous or offline target. */
export async function connectedDevices(): Promise<string[]> {
  const output = await new Promise<string>((resolve, reject) => {
    execFile("adb", ["devices"], { timeout: TIMEOUT_MS, windowsHide: true }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    );
  });
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts[1] === "device")
    .map((parts) => parts[0]!);
}
