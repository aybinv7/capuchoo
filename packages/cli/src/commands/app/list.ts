import { Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { CloudClient } from "../../services/cloud.js";
import { readProjectConfig, resolveCredentials } from "../../utils/config.js";

export default class AppList extends BaseCommand {
  static override description = "List the apps this account can reach";

  static override flags = {
    json: Flags.boolean({ default: false, description: "Machine-readable output" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AppList);

    const credentials = resolveCredentials();
    if (!credentials) {
      this.error(`Not authenticated. Run ${chalk.cyan("capuchoo auth login")}.`);
    }

    const cloud = new CloudClient(credentials.endpoint, credentials.apiKey);
    const apps = await cloud.apps();

    if (flags.json) {
      this.log(JSON.stringify(apps, null, 2));
      return;
    }

    if (apps.length === 0) {
      this.log("");
      this.log(chalk.yellow("  No apps yet."));
      this.log(chalk.dim("  Register one with: capuchoo init --create") + "\n");
      return;
    }

    // Marking the linked one turns this into an answer to "which app am I about
    // to deploy to", which is the reason to run it from a project directory.
    const linked = readProjectConfig(process.cwd())?.cloudAppId;

    this.log("");
    for (const app of apps) {
      const marker = app.id === linked ? chalk.green(" <- this directory") : "";
      this.log(`  ${app.name.padEnd(24)} ${chalk.dim(app.app_id)}${marker}`);
    }
    this.log("");
  }
}
