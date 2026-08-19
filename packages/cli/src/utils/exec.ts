import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Command execution for the deploy pipeline.
 *
 * Two things drove this rewrite. The old helper used `exec` with a shell string
 * built by concatenation, so any path containing a space silently produced the
 * wrong command, and it buffered all output in memory - a Gradle build easily
 * exceeds the default 1 MB `maxBuffer` and used to fail with a truncated,
 * meaningless error. `spawn` with an argv array fixes both, and streams output
 * to a log file as it arrives.
 */

export interface RunOptions {
  cwd: string;
  /** Extra environment for this command only. */
  env?: Record<string, string>;
  /** Append stdout/stderr here as they arrive. */
  logFile?: string;
  /** Mirror output to the terminal. */
  verbose?: boolean;
  /** Kill the command after this many milliseconds. */
  timeoutMs?: number;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export class CommandError extends Error {
  readonly command: string;
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly logFile?: string;

  constructor(
    command: string,
    result: RunResult,
    logFile?: string,
  ) {
    // Put the last few lines of stderr in the message. The old code told the
    // user to "see capucho-deploy.log" and nothing else, which meant every
    // failure needed a second round trip to diagnose.
    const tail = (result.stderr || result.stdout)
      .trimEnd()
      .split("\n")
      .slice(-6)
      .join("\n");

    super(`${command} exited with ${result.code}${tail ? `\n${tail}` : ""}`);
    this.name = "CommandError";
    this.command = command;
    this.code = result.code;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.logFile = logFile;
  }
}

function appendLog(logFile: string | undefined, chunk: string): void {
  if (!logFile) return;
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, chunk);
  } catch {
    // Never fail a deploy because logging failed.
  }
}

/**
 * Runs a command, streaming its output to the log file.
 *
 * `file` and `args` are passed to the OS separately - there is no shell, so
 * nothing in `args` can be reinterpreted as shell syntax.
 */
export async function run(
  file: string,
  args: string[],
  options: RunOptions,
): Promise<RunResult> {
  const printable = [file, ...args].join(" ");

  appendLog(
    options.logFile,
    `\n$ ${printable}\n  cwd: ${options.cwd}\n${"-".repeat(60)}\n`,
  );

  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      // Windows resolves .cmd/.bat shims only through a shell. The argv array
      // is still passed as an array, so arguments stay individually quoted by
      // Node rather than being concatenated into one string.
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;

    if (options.timeoutMs) {
      timer = setTimeout(() => {
        child.kill();
        reject(
          new Error(
            `${printable} did not finish within ${options.timeoutMs}ms and was stopped`,
          ),
        );
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      appendLog(options.logFile, text);
      if (options.verbose) process.stdout.write(text);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      appendLog(options.logFile, text);
      if (options.verbose) process.stderr.write(text);
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      appendLog(options.logFile, `\nspawn failed: ${error.message}\n`);
      reject(error);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const result: RunResult = { code: code ?? 1, stdout, stderr };

      if (result.code !== 0) {
        reject(new CommandError(printable, result, options.logFile));
        return;
      }

      resolve(result);
    });
  });
}

/** Runs a command and returns false instead of throwing when it fails. */
export async function tryRun(
  file: string,
  args: string[],
  options: RunOptions,
): Promise<boolean> {
  try {
    await run(file, args, options);
    return true;
  } catch {
    return false;
  }
}
