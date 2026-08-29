import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { confirm, isInteractive, log } from "../../cli/prompts.js";
import { CloudClient } from "../../services/cloud.js";
import { readProjectConfig, resolveCredentials } from "../../utils/config.js";
import { runnable } from "../../cli/invocation.js";

/**
 * Deleting an app takes its channels, bundles and update history with it, and
 * every installed copy stops receiving updates. So the identifier is required
 * as an argument rather than read from project.json - deleting whatever
 * directory you happen to be standing in is too easy a mistake - and the
 * confirmation asks for nothing less than the bundle id.
 */
export default class AppDelete extends BaseCommand {
  static override description = "Delete an app, its channels and its bundles";

  static override examples = ["<%= config.bin %> app delete com.company.app"];

  static override args = {
    appId: Args.string({ description: "Bundle identifier of the app to delete" }),
  };

  static override flags = {
    yes: Flags.boolean({
      char: "y",
      default: false,
      description: "Skip the confirmation (scripts and CI)",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AppDelete);

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan(runnable(`auth login`))}.`);
    }

    const wanted = args.appId?.trim();
    if (!wanted) {
      this.error(
        "Which app? Pass its bundle identifier, e.g. capuchoo app delete com.company.app.",
      );
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const apps = await cloud.apps();
    const app = apps.find((candidate) => candidate.app_id === wanted || candidate.id === wanted);

    if (!app) {
      this.error(
        `No app called "${wanted}" on this account. ` +
          `Available: ${apps.map((candidate) => candidate.app_id).join(", ") || "none"}.`,
      );
    }

    const channels = await cloud.channels(app.id).catch(() => []);
    const serving = channels.filter((channel) => channel.current_version_id);

    log.warn(
      `${app.name} has ${channels.length} channel(s)` +
        (serving.length > 0 ? `, ${serving.length} of them serving a bundle right now` : "") +
        ". Deleting it takes them and the update history with it, and installed " +
        "copies stop receiving updates.",
    );

    if (readProjectConfig(process.cwd())?.cloudAppId === app.id) {
      log.warn("This is the app the current directory is linked to.");
    }

    if (!flags.yes && !isInteractive()) {
      this.error(`Refusing to delete ${app.app_id} unattended. Pass --yes.`);
    }

    const proceed =
      flags.yes ||
      (await confirm(`Delete ${app.name} (${app.app_id}) for good?`, {
        default: false,
        flag: "--yes",
      }));

    if (!proceed) {
      this.log(chalk.dim("  Nothing was deleted."));
      return;
    }

    await cloud.deleteApp(app.id);

    this.log("");
    this.log(`  ${chalk.green("Deleted")} ${app.name} ${chalk.dim(app.app_id)}`);
    this.log(
      chalk.dim("  .capuchoo/project.json still points at it - remove it or re-run init.") + "\n",
    );
  }
}
