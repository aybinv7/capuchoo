/**
 * Which packages an app is missing, and installing them.
 *
 * Extracted from the `setup` command so `init` can do the same work as one of
 * its steps rather than telling you to run a second command. Planning is
 * separated from doing: what would be installed is a fact worth reporting
 * before anything is written, and a fact worth testing without a package
 * manager.
 */

import fs from "node:fs";
import path from "node:path";
import {
  SUPPORTED_MAJORS,
  detectCapacitor,
  installSpec,
  isSupportedMajor,
  nativePackages,
  runtimePackages,
  telemetryPackages,
  type PackageSpec,
} from "./capacitor-support.js";
import { detectToolchain, lookupTools, type PackageManager } from "./toolchain.js";
import { run } from "../utils/exec.js";

const INSTALL_ARGS: Record<PackageManager, (dev: boolean) => string[]> = {
  pnpm: (dev) => (dev ? ["add", "-D"] : ["add"]),
  npm: (dev) => (dev ? ["install", "--save-dev"] : ["install"]),
  yarn: (dev) => (dev ? ["add", "-D"] : ["add"]),
  bun: (dev) => (dev ? ["add", "-d"] : ["add"]),
};

export interface InstallOptions {
  /** Also the four plugins the in-app APK install needs. */
  native?: boolean;
  /** @capacitor/device, for update telemetry. */
  telemetry?: boolean;
  /** This CLI's own version, pinned as a dev dependency for the team and CI. */
  cliVersion?: string | undefined;
}

export interface InstallPlan {
  capacitorMajor: number | null;
  /** Runtime dependencies the app does not declare yet. */
  missing: PackageSpec[];
  /** The CLI itself, when absent. Installed as a dev dependency. */
  missingCli: PackageSpec | null;
  /** Set when this app cannot be set up at all, with the reason. */
  refusal: string | null;
}

function cliPackage(version: string): PackageSpec {
  return {
    name: "@capuchoo/cli",
    range: `^${version}`,
    why: "this tool, pinned for your team and CI",
  };
}

/**
 * What is missing, without touching anything.
 *
 * Version selection is the whole reason this is not a fixed list: installing
 * bare names resolves to `latest`, which puts Capacitor 8 plugins into a
 * Capacitor 7 app.
 */
export function planInstall(appDir: string, options: InstallOptions = {}): InstallPlan {
  const manifestPath = path.join(appDir, "package.json");

  if (!fs.existsSync(manifestPath)) {
    return {
      capacitorMajor: null,
      missing: [],
      missingCli: null,
      refusal: `No package.json in ${appDir}. Run this from the application's root.`,
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const installed = { ...manifest.dependencies, ...manifest.devDependencies };
  const capacitor = detectCapacitor(manifest);

  if (!isSupportedMajor(capacitor.major)) {
    return {
      capacitorMajor: capacitor.major,
      missing: [],
      missingCli: null,
      refusal:
        capacitor.major === null
          ? "No @capacitor/core in this package.json, so this is not a Capacitor app yet. " +
            "Run npx cap init first."
          : `This app is on Capacitor ${capacitor.major}, and Capuchoo installs for ` +
            `${SUPPORTED_MAJORS.join(" and ")}. Upgrade the app, or open an issue - the ` +
            "runtime itself is version-agnostic, only the plugin versions are pinned.",
    };
  }

  const wanted = [
    ...runtimePackages(capacitor.major),
    ...(options.telemetry === false ? [] : telemetryPackages(capacitor.major)),
    ...(options.native ? nativePackages(capacitor.major) : []),
  ];

  const cli = options.cliVersion ? cliPackage(options.cliVersion) : null;

  return {
    capacitorMajor: capacitor.major,
    missing: wanted.filter((pkg) => !installed[pkg.name]),
    missingCli: cli && !installed[cli.name] ? cli : null,
    refusal: null,
  };
}

export function nothingToInstall(plan: InstallPlan): boolean {
  return plan.missing.length === 0 && plan.missingCli === null;
}

/**
 * Installs the plan, then syncs.
 *
 * The packages have to be the *application's* own dependencies: `cap sync`
 * finds plugins by reading the app's `dependencies` and `devDependencies` and
 * does not recurse, so a Capacitor plugin pulled in transitively by
 * @capuchoo/updater would have its JavaScript installed and its native half
 * never added to the Android or iOS project.
 *
 * Native code only reaches those projects through `cap sync`, so an install
 * without it looks successful and fails on a device.
 */
export async function applyInstall(
  appDir: string,
  plan: InstallPlan,
  options: { sync?: boolean; verbose?: boolean } = {},
): Promise<void> {
  const toolchain = detectToolchain(appDir);
  const args = INSTALL_ARGS[toolchain.packageManager];
  const verbose = options.verbose ?? true;

  if (plan.missing.length > 0) {
    await run(toolchain.packageManager, [...args(false), ...plan.missing.map(installSpec)], {
      cwd: appDir,
      verbose,
    });
  }

  if (plan.missingCli) {
    await run(toolchain.packageManager, [...args(true), installSpec(plan.missingCli)], {
      cwd: appDir,
      verbose,
    });
  }

  if (options.sync === false) return;

  const { capacitor } = lookupTools(appDir);
  if (capacitor.bin) {
    await run(capacitor.bin, ["sync"], { cwd: appDir, verbose });
  }
}
