import { Flags } from "@oclif/core";
import chalk from "chalk";
import { CloudClient } from "../../services/cloud.js";
import { requireProjectConfig, resolveCredentials } from "../../utils/config.js";
import { whileWaiting } from "../../cli/prompts.js";
import { BaseCommand } from "../../base-command.js";
import { runnable } from "../../cli/invocation.js";

export default class ChannelList extends BaseCommand {
  static override description = "List this app's channels and what they serve";

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ChannelList);
    const project = requireProjectConfig(process.cwd());

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan(runnable(`auth login`))}.`);
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const channels = await whileWaiting("Reading channels...", cloud.channels(project.cloudAppId));

    if (flags.json) {
      this.log(JSON.stringify(channels, null, 2));
      return;
    }

    if (channels.length === 0) {
      this.log("");
      this.log(chalk.yellow(`  ${project.appName} has no channels yet.`));
      this.log(chalk.dim("  Create one with: capuchoo channel create staging"));
      this.log("");
      return;
    }

    this.log("");
    this.log(chalk.dim(`  ${project.appName}`));
    this.log("");

    for (const channel of channels) {
      // A channel with no environment cannot be deployed to, because the
      // environment is what selects the build flavour. Flag it here rather than
      // letting a deploy discover it.
      const environment = channel.environment
        ? chalk.dim(`(${channel.environment})`)
        : chalk.red("(no environment - not deployable)");

      this.log(
        `  ${channel.name.padEnd(16)} ${environment} ` +
          chalk.dim(channel.public ? "public" : "private"),
      );
    }

    this.log("");
  }
}
