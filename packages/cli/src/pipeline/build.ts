import fs from "node:fs";
import path from "node:path";
import { run, type RunOptions } from "../utils/exec.js";
import type { ResolvedFlavour } from "./flavour.js";
import { readScript, resolveBin, type Toolchain } from "./toolchain.js";

/**
 * The web build, icon generation and Capacitor sync.
 *
 * Every step here resolves its own executable out of `node_modules/.bin` rather
 * than going through a package.json script. The old pipeline ran
 * `pnpm run assets:<env>`, `pnpm build:<env>` and `pnpm exec cap sync`, which
 * meant an application had to define scripts with exactly those names, use
 * pnpm, and duplicate the flavour wiring in every one of them - the same
 * `dotenv -e build/<env>/.env.<env> --` prefix repeated a dozen times, drifting
 * a little each time.
 */

export interface StepContext {
  toolchain: Toolchain;
  flavour: ResolvedFlavour;
  /** Flavour values plus the resolved version. */
  env: Record<string, string>;
  runOptions: Omit<RunOptions, "cwd" | "env">;
}

export type StepOutcome =
  | { ran: true; via: string }
  | { ran: false; reason: string };

/**
 * Generates launcher icons and splash screens.
 *
 * Optional by design: icons rarely change and an app may not ship source
 * artwork at all, so a missing tool or asset directory is a skip, not a
 * failure.
 */
export async function generateAssets(
  context: StepContext,
  platform: "android" | "ios",
): Promise<StepOutcome> {
  const { toolchain, flavour } = context;

  if (!flavour.assetPath) {
    return { ran: false, reason: `no asset directory at ${flavour.config.assetPath}` };
  }

  const sources = fs
    .readdirSync(flavour.assetPath)
    .filter((name) => /^(icon|splash)(-dark)?\.(png|svg)$/.test(name));

  if (sources.length === 0) {
    return {
      ran: false,
      reason: `${flavour.config.assetPath} has no icon.png or splash.png`,
    };
  }

  const bin = resolveBin("capacitor-assets", toolchain.appDir);
  if (!bin) {
    return { ran: false, reason: "@capacitor/assets is not installed" };
  }

  await run(
    bin,
    ["generate", `--${platform}`, "--assetPath", flavour.assetPath],
    { ...context.runOptions, cwd: toolchain.appDir, env: context.env },
  );

  return { ran: true, via: "@capacitor/assets" };
}

/**
 * Builds the web assets.
 *
 * Resolution order, most explicit first:
 *   1. `build.command` in project.json - the app has said exactly what to run.
 *   2. A `build:<mode>` script, if the app already has one that works.
 *   3. Vite directly, with `--mode <flavour>`.
 *
 * The flavour's variables are passed as environment rather than through
 * `dotenv-cli`, so no extra dependency is needed and the values are identical
 * to the ones the native configuration step receives.
 */
export async function buildWeb(
  context: StepContext,
  build: { command?: string; cwd?: string },
): Promise<StepOutcome> {
  const { toolchain, flavour } = context;
  const cwd = build.cwd
    ? path.resolve(toolchain.appDir, build.cwd)
    : toolchain.appDir;

  const options = { ...context.runOptions, cwd, env: context.env };

  if (build.command) {
    const [file, ...args] = tokenize(build.command);
    if (!file) throw new Error("build.command in project.json is empty");

    // A workspace-local binary beats whatever is on PATH.
    const resolved = resolveBin(file, toolchain.appDir) ?? file;
    await run(resolved, args, options);
    return { ran: true, via: build.command };
  }

  const scriptName = `build:${flavour.mode}`;
  if (readScript(toolchain.appDir, scriptName)) {
    await run(toolchain.packageManager, ["run", scriptName], options);
    return { ran: true, via: `${toolchain.packageManager} run ${scriptName}` };
  }

  const viteBin = resolveBin("vite", toolchain.appDir);
  if (viteBin) {
    await run(viteBin, ["build", "--mode", flavour.mode], options);
    return { ran: true, via: `vite build --mode ${flavour.mode}` };
  }

  const vpBin = resolveBin("vp", toolchain.appDir);
  if (vpBin) {
    await run(vpBin, ["build", "--mode", flavour.mode], options);
    return { ran: true, via: `vp build --mode ${flavour.mode}` };
  }

  throw new Error(
    "Nothing to build with: no build.command in .capucho/project.json, no " +
      `"${scriptName}" script, and neither vite nor vp is installed.`,
  );
}

/**
 * Copies the built web assets into the native project and updates plugins.
 *
 * Runs after the native configuration step, because `cap sync` regenerates
 * plugin registration files and rewriting the identity afterwards would leave
 * those pointing at the previous package name.
 */
export async function syncCapacitor(
  context: StepContext,
  platform: "android" | "ios",
): Promise<StepOutcome> {
  const bin = resolveBin("cap", context.toolchain.appDir);
  if (!bin) {
    return { ran: false, reason: "@capacitor/cli is not installed" };
  }

  await run(bin, ["sync", platform], {
    ...context.runOptions,
    cwd: context.toolchain.appDir,
    env: context.env,
  });

  return { ran: true, via: `cap sync ${platform}` };
}

/**
 * Splits a command string into argv, honouring quoted segments.
 *
 * Needed because `build.command` comes from a config file as one string. The
 * previous code passed such strings straight to a shell, so a path containing a
 * space became two arguments.
 */
export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of command.trim()) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error(`Unbalanced ${quote} in command: ${command}`);
  }
  if (current) tokens.push(current);

  return tokens;
}
