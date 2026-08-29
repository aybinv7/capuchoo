/**
 * How to run this CLI, in the package manager the app actually uses.
 *
 * Every printed next step said `capuchoo <something>`, which is only runnable if
 * the binary happens to be on PATH. The usual advice - prefix it with `npx` -
 * is worse than useless in a pnpm project that declares `devEngines`: npm
 * refuses to run *anything* there, including this CLI.
 *
 *   npm error EBADDEVENGINES Invalid name "pnpm" does not match "npm"
 *
 * That is not npm being broken; it is npm honouring a manifest that says this
 * project is pnpm's. So the command has to be spelled the way that project's
 * package manager spells it, and the CLI already knows which one that is.
 */

import { detectToolchain, type PackageManager } from "../pipeline/toolchain.js";

/**
 * The prefix that runs a locally installed binary.
 *
 * `init` installs @capuchoo/cli as a dev dependency, so by the time any of these
 * are printed the binary is local and these all resolve it.
 */
const RUN: Record<PackageManager, string> = {
  pnpm: "pnpm exec",
  npm: "npx",
  yarn: "yarn",
  bun: "bunx",
};

/**
 * The prefix that runs it *without* installing it first.
 *
 * For the very first command, before anything is a dependency of anything.
 * `yarn dlx` is Berry-only; `npx` is the safe spelling for classic yarn, and
 * being slightly conservative here costs nothing.
 */
const ONCE: Record<PackageManager, string> = {
  pnpm: "pnpm dlx @capuchoo/cli",
  npm: "npx @capuchoo/cli",
  yarn: "npx @capuchoo/cli",
  bun: "bunx @capuchoo/cli",
};

/** `pnpm exec capuchoo deploy ota --channel dev`, for whichever manager it is. */
export function runCommand(packageManager: PackageManager, args: string, bin = "capuchoo"): string {
  return `${RUN[packageManager]} ${bin} ${args}`.trim();
}

/** The same, for someone who has not installed it yet. */
export function runOnce(packageManager: PackageManager, args: string): string {
  return `${ONCE[packageManager]} ${args}`.trim();
}

/**
 * `runCommand` for the directory the CLI is running in.
 *
 * Detected once and remembered: a command prints several of these and the
 * package manager cannot change between two lines of the same output.
 */
let detected: PackageManager | null = null;

export function runnable(args: string): string {
  detected ??= detectToolchain(process.cwd()).packageManager;
  return runCommand(detected, args);
}

/** Only for tests, which need to exercise more than one manager per process. */
export function resetDetectedPackageManager(): void {
  detected = null;
}
