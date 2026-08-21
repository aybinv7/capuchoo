import chalk from "chalk";
import { readGlobalConfig, writeGlobalConfig } from "../../utils/config.js";
import { BaseCommand } from "../../base-command.js";

export default class AuthLogout extends BaseCommand {
  static override description = "Remove the stored API key";

  async run(): Promise<void> {
    const config = readGlobalConfig();

    if (!config.apiKey) {
      this.log(chalk.dim("No stored credentials to remove."));
    } else {
      // The endpoint is a preference, not a credential - keeping it means the
      // next login pre-fills the right server. Everything else goes.
      writeGlobalConfig({ endpoint: config.endpoint });
      this.log(chalk.green("Signed out. The stored API key has been removed."));
    }

    if (process.env.CAPUCHOO_API_KEY) {
      this.log(
        chalk.yellow("! CAPUCHOO_API_KEY is set in this environment and still takes precedence."),
      );
    }
  }
}
