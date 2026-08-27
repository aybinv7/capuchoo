import { describeCap, isAppRole } from "@capuchoo/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { whileWaiting } from "../../cli/prompts.js";
import { requireCloud } from "../../cli/team.js";
import { resolveCredentials } from "../../utils/config.js";

export default class AuthKeys extends BaseCommand {
  static override description = "List the API keys on this account";

  static override examples = ["<%= config.bin %> auth keys"];

  async run(): Promise<void> {
    const cloud = requireCloud(this);
    const current = resolveCredentials();

    const keys = await whileWaiting("Reading keys...", cloud.apiKeys());

    this.log("");

    if (keys.length === 0) {
      this.log(chalk.dim("  No keys."));
      this.log("");
      return;
    }

    for (const key of keys) {
      // A key is shown once, at creation, so the prefix is the only way to tell
      // which stored credential a row corresponds to.
      const mine = key.key_prefix ? current?.apiKey.startsWith(key.key_prefix) : false;
      const scope = key.app_id ? chalk.yellow("one app") : chalk.dim("all apps");

      this.log(
        `  ${chalk.bold(key.name)} ${chalk.dim(key.key_prefix ?? "")}` +
          `${mine ? chalk.green("  (this machine)") : ""}`,
      );
      const cap = isAppRole(key.role)
        ? chalk.yellow(describeCap(key.role))
        : chalk.dim(describeCap(null));
      this.log(`    ${scope}   ${cap}`);
      this.log(`    ${chalk.dim(`id ${key.id}`)}`);
    }

    this.log("");
    this.log(chalk.dim("  Revoke one with: capuchoo auth revoke <id>"));
    this.log(
      chalk.dim("  Issue a limited one with: capuchoo auth issue --role developer --this-app"),
    );
    this.log("");
  }
}
