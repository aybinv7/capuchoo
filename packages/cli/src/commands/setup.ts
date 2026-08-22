import { Flags } from "@oclif/core";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { BaseCommand } from "../base-command.js";
import { confirm, isInteractive, log, note } from "../cli/prompts.js";
import { detectToolchain, lookupTools, type PackageManager } from "../pipeline/toolchain.js";
import { run } from "../utils/exec.js";

/**
 * Packages an app needs, and why each one is here.
 *
 * They have to be the *application's* own dependencies. `cap sync` finds plugins
 * by reading the app's `dependencies` and `devDependencies` - @capacitor/cli's
 * `getDependencies()` does not recurse - so a Capacitor plugin pulled in
 * transitively by @capuchoo/updater would have its JavaScript installed and its
 * native half never added to the Android or iOS project. That is why this command
 * exists instead of a longer dependency list on the updater.
 */
const RUNTIME = [
  { name: "@capuchoo/updater", why: "the update runtime" },
  { name: "@capgo/capacitor-updater", why: "the native plugin it drives" },
  { name: "@capacitor/app", why: "reads the installed version and build number" },
];

const TELEMETRY = [{ name: "@capacitor/device", why: "reports OS version and emulator flag" }];

/** Only needed to download and install an APK from inside the app. */
const NATIVE = [
  { name: "@capacitor/file-transfer", why: "downloads the APK" },
  { name: "@capacitor/filesystem", why: "caches it" },
  { name: "@capacitor/network", why: "checks connectivity first" },
  { name: "@capawesome-team/capacitor-file-opener", why: "hands it to the installer" },
];

const CLI = { name: "@capuchoo/cli", why: "this tool, pinned for your team and CI" };

const INSTALL_ARGS: Record<PackageManager, (dev: boolean) => string[]> = {
  pnpm: (dev) => (dev ? ["add", "-D"] : ["add"]),
  npm: (dev) => (dev ? ["install", "--save-dev"] : ["install"]),
  yarn: (dev) => (dev ? ["add", "-D"] : ["add"]),
  bun: (dev) => (dev ? ["add", "-d"] : ["add"]),
};

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

    const wanted = [
      ...RUNTIME,
      ...(flags["skip-telemetry"] ? [] : TELEMETRY),
      ...(flags.native ? NATIVE : []),
    ];
    const missing = wanted.filter((pkg) => !installed[pkg.name]);
    const missingCli = installed[CLI.name] ? null : CLI;

    this.log("");
    this.log(chalk.bold("  Capuchoo setup"));
    this.log(chalk.dim(`  ${appDir}`));
    this.log("");

    if (missing.length === 0 && !missingCli) {
      log.success("Everything is already installed.");
      this.reportNextSteps(appDir);
      return;
    }

    for (const pkg of missing) {
      this.log(`  ${chalk.green("+")} ${pkg.name} ${chalk.dim(`- ${pkg.why}`)}`);
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
        [...INSTALL_ARGS[toolchain.packageManager](false), ...missing.map((p) => p.name)],
        { cwd: appDir, verbose: true },
      );
    }
    if (missingCli) {
      await run(
        toolchain.packageManager,
        [...INSTALL_ARGS[toolchain.packageManager](true), missingCli.name],
        { cwd: appDir, verbose: true },
      );
    }

    // Native code only reaches the Android and iOS projects through cap sync, so
    // an install without it looks successful and fails on a device.
    if (!flags["skip-sync"]) {
      const { capacitor } = lookupTools(appDir);
      if (capacitor.bin) {
        log.step("cap sync");
        await run(capacitor.bin, ["sync"], { cwd: appDir, verbose: true });
      } else {
        log.warn(
          `@capacitor/cli is not installed, so the native projects were not synced. ` +
            `Run "npx cap sync" once it is - without it the new plugins exist in ` +
            `JavaScript only.`,
        );
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
