import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { confirm, isInteractive, log, whileWaiting } from "../../cli/prompts.js";
import { requireCloud } from "../../cli/team.js";
import { readProjectConfig } from "../../utils/config.js";
import { APP_FLAVOURS, type AppFlavour } from "@capuchoo/core";
import { runnable } from "../../cli/invocation.js";

/**
 * The bundle identifiers an app answers for.
 *
 * An app used to be one identifier, and the server read the flavour off the end
 * of it. So a project that suffixes per flavour needed three Capuchoo apps -
 * splitting its channels, devices and statistics three ways - and a project that
 * does not suffix could never serve a dev channel, because every build parsed as
 * production.
 */
export default class AppIdentifiers extends BaseCommand {
  static override description = "List, add or remove the bundle identifiers this app ships under";

  static override examples = [
    "<%= config.bin %> app identifiers",
    "<%= config.bin %> app identifiers add com.acme.app.dev --flavour dev",
    "<%= config.bin %> app identifiers remove com.acme.app.dev",
  ];

  static override args = {
    action: Args.string({
      description: "list, add or remove",
      options: ["list", "add", "remove"],
      default: "list",
    }),
    bundleId: Args.string({ description: "Bundle identifier, for add and remove" }),
  };

  static override flags = {
    flavour: Flags.string({
      description:
        "Which flavour ships under it. Omit when every flavour does, which turns the gate off.",
      options: [...APP_FLAVOURS],
    }),
    platform: Flags.string({
      description: "android, ios, or all",
      options: ["android", "ios", "all"],
    }),
    yes: Flags.boolean({ char: "y", default: false, description: "Skip the confirmation" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AppIdentifiers);
    const cloud = requireCloud(this);

    const project = readProjectConfig(process.cwd());
    if (!project) {
      this.error(`This directory is not linked to an app. Run ${chalk.cyan(runnable(`init`))}.`);
    }

    if (args.action === "add") await this.add(cloud, project.cloudAppId, args.bundleId, flags);
    else if (args.action === "remove")
      await this.remove(cloud, project.cloudAppId, args.bundleId, flags.yes);
    else await this.list(cloud, project.cloudAppId);
  }

  private async list(cloud: ReturnType<typeof requireCloud>, cloudAppId: string): Promise<void> {
    const rows = await whileWaiting("Reading identifiers...", cloud.identifiers(cloudAppId));

    this.log("");

    if (rows.length === 0) {
      this.log(chalk.dim("  None registered. Update checks fall back to the app's own id."));
      this.log("");
      return;
    }

    for (const row of rows) {
      const flavour = row.flavour
        ? chalk.yellow(`${row.flavour} only`)
        : chalk.dim("every flavour");
      this.log(`  ${chalk.bold(row.bundle_id)}`);
      this.log(`    ${flavour}   ${chalk.dim(row.platform ?? "all")}`);
    }

    this.log("");
    this.log(
      chalk.dim("  Add one with: capuchoo app identifiers add <bundle-id> --flavour <flavour>"),
    );
    this.log("");
  }

  private async add(
    cloud: ReturnType<typeof requireCloud>,
    cloudAppId: string,
    bundleId: string | undefined,
    flags: { flavour?: string | undefined; platform?: string | undefined },
  ): Promise<void> {
    if (!bundleId) this.error("Which identifier? capuchoo app identifiers add com.acme.app.dev");

    const flavour = flags.flavour as AppFlavour | undefined;

    const row = await whileWaiting(
      "Registering...",
      cloud.registerIdentifier(cloudAppId, {
        bundle_id: bundleId,
        ...(flags.platform ? { platform: flags.platform } : {}),
        ...(flavour ? { flavour } : {}),
      }),
    );

    this.log("");
    this.log(`  ${chalk.green("Registered")} ${row.bundle_id}`);
    this.log(
      `    ${flavour ? chalk.yellow(`${flavour} only`) : chalk.dim("every flavour - no flavour gate")}`,
    );
    this.log("");

    if (!flavour) {
      log.info(
        "Registered without a flavour, so any channel may serve it. Pass --flavour to " +
          "restrict it to one - worth doing when this identifier is built by a single flavour.",
      );
    }
  }

  private async remove(
    cloud: ReturnType<typeof requireCloud>,
    cloudAppId: string,
    bundleId: string | undefined,
    yes: boolean,
  ): Promise<void> {
    if (!bundleId) this.error("Which identifier? capuchoo app identifiers remove com.acme.app.dev");

    if (!yes) {
      if (!isInteractive()) this.error(`Refusing to remove "${bundleId}" unattended. Pass --yes.`);
      // Devices already running this identifier stop resolving, so this is not a
      // reversible bookkeeping change.
      this.log("");
      this.log(
        chalk.yellow(
          `  Installs reporting ${bundleId} will answer "App not found" until it is registered again.`,
        ),
      );
      if (!(await confirm(`Remove "${bundleId}"?`, { default: false }))) return;
    }

    await whileWaiting("Removing...", cloud.removeIdentifier(cloudAppId, bundleId));

    this.log("");
    this.log(`  ${chalk.green("Removed")} ${bundleId}`);
    this.log("");
  }
}
