import { Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { BaseCommand } from "../base-command.js";
import { confirm, isInteractive, log, note } from "../cli/prompts.js";
import {
  SUPPORTED_MAJORS,
  detectCapacitor,
  installSpec,
  isSupportedMajor,
  nativePackages,
  runtimePackages,
  telemetryPackages,
  type PackageSpec,
} from "../pipeline/capacitor-support.js";
import { detectToolchain, lookupTools, type PackageManager } from "../pipeline/toolchain.js";
import { run } from "../utils/exec.js";

/**
 * Installs what an app needs to receive updates, at versions that match the
 * Capacitor it is already on.
 *
 * The packages have to be the *application's* own dependencies. `cap sync` finds
 * plugins by reading the app's `dependencies` and `devDependencies` -
 * @capacitor/cli's `getDependencies()` does not recurse - so a Capacitor plugin
 * pulled in transitively by @capuchoo/updater would have its JavaScript
 * installed and its native half never added to the Android or iOS project. That
 * is why this command exists instead of a longer dependency list on the updater.
 *
 * Version selection lives in pipeline/capacitor-support.ts: installing bare
 * names resolves to `latest`, which puts Capacitor 8 plugins into a Capacitor 7
 * app.
 */

function cliPackage(version: string): PackageSpec {
  return {
    name: "@capuchoo/cli",
    range: `^${version}`,
    why: "this tool, pinned for your team and CI",
  };
}

const INSTALL_ARGS: Record<PackageManager, (dev: boolean) => string[]> = {
  pnpm: (dev) => (dev ? ["add", "-D"] : ["add"]),
  npm: (dev) => (dev ? ["install", "--save-dev"] : ["install"]),
  yarn: (dev) => (dev ? ["add", "-D"] : ["add"]),
  bun: (dev) => (dev ? ["add", "-d"] : ["add"]),
};

/**
 * `webDir` out of capacitor.config.*, by regex.
 *
 * The config is frequently TypeScript, so importing it would mean compiling it.
 * A miss returns null and the caller simply attempts the sync, which is the old
 * behaviour.
 */
function readWebDir(appDir: string): string | null {
  for (const name of ["capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"]) {
    const file = path.join(appDir, name);
    if (!fs.existsSync(file)) continue;

    const match = /["']?webDir["']?\s*:\s*["']([^"']+)["']/.exec(fs.readFileSync(file, "utf8"));
    if (match?.[1]) return match[1];
  }
  return null;
}

export default class Setup extends BaseCommand {
  static override description = "Install everything this app needs to receive updates";

  static override examples = [
    "<%= config.bin %> setup",
    "<%= config.bin %> setup --native",
    "<%= config.bin %> setup --dry-run",
  ];

  static override flags = {
    native: Flags.boolean({
      default: false,
      description: "Also install what downloading and installing an APK needs",
    }),
    "skip-telemetry": Flags.boolean({
      default: false,
      description: "Do not install @capacitor/device",
    }),
    "skip-sync": Flags.boolean({
      default: false,
      description: "Do not run cap sync afterwards",
    }),
    "dry-run": Flags.boolean({
      default: false,
      description: "Report what would be installed, change nothing",
    }),
    yes: Flags.boolean({ char: "y", default: false, description: "Accept every prompt" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Setup);
    const appDir = process.cwd();

    const manifestPath = path.join(appDir, "package.json");
    if (!fs.existsSync(manifestPath)) {
      this.error(`No package.json in ${appDir}. Run this from your application's root.`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const installed = { ...manifest.dependencies, ...manifest.devDependencies };

    // Which Capacitor this app is on decides every version below, so an
    // unsupported or absent one stops here rather than installing a set of
    // plugins nobody has run together.
    const capacitor = detectCapacitor(manifest);
    if (!isSupportedMajor(capacitor.major)) {
      this.error(
        capacitor.major === null
          ? "No @capacitor/core in this package.json, so this is not a Capacitor app yet. " +
              "Run npx cap init first, then this command."
          : `This app is on Capacitor ${capacitor.major}, and Capuchoo installs for ` +
              `${SUPPORTED_MAJORS.join(" and ")}. Upgrade the app, or open an issue - the ` +
              "runtime itself is version-agnostic, only the plugin versions are pinned.",
      );
    }

    const wanted = [
      ...runtimePackages(capacitor.major),
      ...(flags["skip-telemetry"] ? [] : telemetryPackages(capacitor.major)),
      ...(flags.native ? nativePackages(capacitor.major) : []),
    ];
    const missing = wanted.filter((pkg) => !installed[pkg.name]);
    const cli = cliPackage(this.config.version);
    const missingCli = installed[cli.name] ? null : cli;

    this.log("");
    this.log(chalk.bold("  Capuchoo setup"));
    this.log(chalk.dim(`  ${appDir}`));
    this.log(chalk.dim(`  Capacitor ${capacitor.major}`));
    this.log("");

    if (missing.length === 0 && !missingCli) {
      log.success("Everything is already installed.");
      this.reportNextSteps(appDir);
      return;
    }

    for (const pkg of missing) {
      const pinned = pkg.range ? chalk.dim(`@${pkg.range}`) : "";
      this.log(`  ${chalk.green("+")} ${pkg.name}${pinned} ${chalk.dim(`- ${pkg.why}`)}`);
    }
    if (missingCli) {
      this.log(
        `  ${chalk.green("+")} ${missingCli.name} ${chalk.dim(`- ${missingCli.why} (dev)`)}`,
      );
    }
    if (!flags.native) {
      this.log("");
      this.log(
        chalk.dim(
          "  Not installed: the four plugins the in-app APK install needs.\n" +
            "  OTA updates do not use them - add them later with --native.",
        ),
      );
    }
    this.log("");

    if (flags["dry-run"]) {
      log.info("Dry run: nothing was installed.");
      return;
    }

    const toolchain = detectToolchain(appDir);
    log.info(`Package manager: ${toolchain.packageManager}`);

    const interactive = !flags.yes && isInteractive();
    if (interactive && !(await confirm("Install these?", { default: true }))) {
      log.warn("Nothing was installed.");
      return;
    }

    if (missing.length > 0) {
      await run(
        toolchain.packageManager,
        [...INSTALL_ARGS[toolchain.packageManager](false), ...missing.map(installSpec)],
        { cwd: appDir, verbose: true },
      );
    }
    if (missingCli) {
      await run(
        toolchain.packageManager,
        [...INSTALL_ARGS[toolchain.packageManager](true), installSpec(missingCli)],
        { cwd: appDir, verbose: true },
      );
    }

    // Native code only reaches the Android and iOS projects through cap sync, so
    // an install without it looks successful and fails on a device.
    if (!flags["skip-sync"]) {
      const { capacitor } = lookupTools(appDir);
      const webDir = readWebDir(appDir);

      if (!capacitor.bin) {
        log.warn(
          `@capacitor/cli is not installed, so the native projects were not synced. ` +
            `Run "npx cap sync" once it is - without it the new plugins exist in ` +
            `JavaScript only.`,
        );
      } else if (webDir && !fs.existsSync(path.join(appDir, webDir))) {
        // cap sync copies the web build, so it fails outright when webDir is
        // absent - which is the normal state of a fresh checkout. Ending a
        // successful install on that error reads as "setup failed".
        log.warn(
          `Skipped cap sync: "${webDir}" does not exist yet, and cap sync copies it.
` +
            `Build the app once, then run "npx cap sync" - until then the new ` +
            `plugins exist in JavaScript only.`,
        );
      } else {
        log.step("cap sync");
        await run(capacitor.bin, ["sync"], { cwd: appDir, verbose: true });
      }
    }

    log.success("Installed.");
    this.reportNextSteps(appDir);
  }

  /** The two edits and two commands that remain. Both are easy to forget. */
  private reportNextSteps(appDir: string): void {
    const hasProject =
      fs.existsSync(path.join(appDir, ".capuchoo", "project.json")) ||
      fs.existsSync(path.join(appDir, ".capucho", "project.json"));

    note(
      [
        `1. Call notifyAppReady() first in your entry file:`,
        `   import { notifyAppReady } from "@capuchoo/updater";`,
        `   void notifyAppReady();`,
        ``,
        `2. Configure the plugin in capacitor.config.ts:`,
        `   import { capuchooUpdaterConfig } from "@capuchoo/updater/capacitor";`,
        `   plugins: { CapacitorUpdater: capuchooUpdaterConfig({ apiUrl, channel }) }`,
        ``,
        hasProject
          ? `3. capuchoo deploy ota --channel <name>`
          : `3. capuchoo auth login && capuchoo init`,
      ].join("\n"),
      "Next",
    );

    this.log(
      chalk.dim(
        "  notifyAppReady() is not optional: the plugin rolls back to the previous\n" +
          "  bundle if it does not hear it, so an update installs and then reverts.\n",
      ),
    );
  }
}
