import { ENVIRONMENTS, environmentMismatchWarning, suggestEnvironment } from "@capuchoo/core";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { confirm, isInteractive, log, selectOne } from "../../cli/prompts.js";
import { CloudClient } from "../../services/cloud.js";
import { requireProjectConfig, resolveCredentials } from "../../utils/config.js";

/**
 * Creating a channel used to be dashboard-only, which broke the CLI story: a
 * deploy needs a channel, so setting an app up meant CLI, then browser, then
 * CLI again. Nothing about it needed a UI.
 *
 * The environment is asked for rather than derived. A channel named `prod` on
 * the staging environment serves staging bundles to production devices and
 * nothing errors - which is how all three of Lowmaro's channels ended up on
 * staging - so the name never silently decides it.
 */
export default class ChannelCreate extends BaseCommand {
  static override description = "Create a channel for this app";

  static override examples = [
    "<%= config.bin %> channel create staging",
    "<%= config.bin %> channel create beta --environment staging",
    "<%= config.bin %> channel create prod --environment prod --yes",
  ];

  static override args = {
    name: Args.string({ description: "Name of the channel, e.g. staging" }),
  };

  static override flags = {
    environment: Flags.string({
      char: "e",
      options: [...ENVIRONMENTS],
      description: "Which build flavour this channel serves",
    }),
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Accept the environment even when it disagrees with the name",
    }),
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ChannelCreate);
    const project = requireProjectConfig(process.cwd());

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan("capuchoo auth login")}.`);
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);

    const name = args.name?.trim();
    if (!name) {
      this.error("Which channel? Pass a name, e.g. capuchoo channel create staging.");
    }

    // A duplicate name is a 409 from the server; catching it here names the
    // existing channel's environment, which is usually what the user wanted.
    const existing = await cloud.channels(project.cloudAppId).catch(() => []);
    const clash = existing.find((channel) => channel.name === name);
    if (clash) {
      this.error(
        `${project.appName} already has a channel called "${name}" ` +
          `on the ${clash.environment} environment.`,
      );
    }

    const suggested = suggestEnvironment(name);
    const environment =
      flags.environment ??
      (suggested && !isInteractive()
        ? suggested
        : await selectOne(
            `Which flavour should "${name}" serve?`,
            ENVIRONMENTS.map((value) => ({
              value,
              label: value,
              ...(value === suggested ? { hint: "matches the name" } : {}),
            })),
            "--environment",
          ));

    // Deliberate mismatches are legitimate - a prod app pointed at a staging
    // channel for beta testing - so this confirms rather than refuses.
    const warning = environmentMismatchWarning(name, environment as never);
    if (warning) {
      log.warn(warning);
      const proceed = await confirm("Create it anyway?", {
        ...(flags.yes ? { default: true } : {}),
        flag: "--yes",
      });
      if (!proceed) this.error("Cancelled. Nothing was created.");
    }

    const channel = await cloud.createChannel({
      app_id: project.cloudAppId,
      name,
      environment: environment as never,
    });

    if (flags.json) {
      this.log(JSON.stringify(channel, null, 2));
      return;
    }

    this.log("");
    this.log(`  ${chalk.green("Created")} ${channel.name} ${chalk.dim(`(${environment})`)}`);
    this.log(
      chalk.dim(`  Deploy to it with: capuchoo deploy ota --channel ${channel.name}`) + "\n",
    );
  }
}
