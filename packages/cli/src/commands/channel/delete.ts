import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { confirm, isInteractive, log } from "../../cli/prompts.js";
import { CloudClient } from "../../services/cloud.js";
import { requireProjectConfig, resolveCredentials } from "../../utils/config.js";

/**
 * Deleting a channel is not recoverable and devices are pointed at it by name,
 * so this confirms by default and says what is currently on it first. A channel
 * serving a bundle is the dangerous case: devices asking for it stop getting
 * updates the moment it disappears.
 */
export default class ChannelDelete extends BaseCommand {
  static override description = "Delete one of this app's channels";

  static override examples = [
    "<%= config.bin %> channel delete beta",
    "<%= config.bin %> channel delete beta --yes",
  ];

  static override args = {
    name: Args.string({ description: "Name of the channel to delete" }),
  };

  static override flags = {
    yes: Flags.boolean({ char: "y", default: false, description: "Skip the confirmation" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelDelete);
    const project = requireProjectConfig(process.cwd());

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan("capuchoo auth login")}.`);
    }

    const name = args.name?.trim();
    if (!name) {
      this.error("Which channel? Pass a name, e.g. capuchoo channel delete beta.");
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const channels = await cloud.channels(project.cloudAppId);
    const channel = channels.find((candidate) => candidate.name === name);

    if (!channel) {
      const available = channels.map((c) => c.name).join(", ") || "none";
      this.error(`${project.appName} has no channel called "${name}". Available: ${available}.`);
    }

    if (channel.current_version_id) {
      log.warn(
        `"${channel.name}" is serving a bundle right now. Devices on it will stop ` +
          "receiving updates.",
      );
    }

    // Exiting 0 without deleting anything reads as success in a script, so a
    // non-interactive run without --yes is an error rather than a quiet no-op.
    if (!flags.yes && !isInteractive()) {
      this.error(`Refusing to delete "${channel.name}" unattended. Pass --yes.`);
    }

    const proceed =
      flags.yes ||
      (await confirm(`Delete "${channel.name}" (${channel.environment}) from ${project.appName}?`, {
        default: false,
        flag: "--yes",
      }));

    if (!proceed) {
      this.log(chalk.dim("  Nothing was deleted."));
      return;
    }

    await cloud.deleteChannel(channel.id, project.cloudAppId);

    this.log("");
    this.log(`  ${chalk.green("Deleted")} ${channel.name}\n`);
  }
}
