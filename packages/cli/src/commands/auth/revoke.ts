import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { confirm, isInteractive, whileWaiting } from "../../cli/prompts.js";
import { requireCloud } from "../../cli/team.js";
import { resolveCredentials } from "../../utils/config.js";

export default class AuthRevoke extends BaseCommand {
  static override description = "Revoke an API key";

  static override examples = ["<%= config.bin %> auth revoke <id>"];

  static override args = {
    id: Args.string({ description: "Key id, from capuchoo auth keys", required: true }),
  };

  static override flags = {
    yes: Flags.boolean({ char: "y", default: false, description: "Skip the confirmation" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AuthRevoke);
    const cloud = requireCloud(this);
    const current = resolveCredentials();

    const keys = await whileWaiting("Reading keys...", cloud.apiKeys());
    const key = keys.find((candidate) => candidate.id === args.id);

    if (!key) {
      this.error(
        `No key with id "${args.id}". Run ${chalk.cyan("capuchoo auth keys")} to see them.`,
      );
    }

    // Revoking the key in use signs this machine out, which is worth saying
    // before it happens rather than after.
    const isCurrent = key.key_prefix ? current?.apiKey.startsWith(key.key_prefix) : false;

    if (!flags.yes) {
      if (!isInteractive()) {
        this.error(`Refusing to revoke "${key.name}" unattended. Pass --yes.`);
      }
      if (isCurrent) {
        this.log("");
        this.log(
          chalk.yellow("  This is the key this machine uses. Revoking it signs you out here."),
        );
      }
      const proceed = await confirm(`Revoke "${key.name}"?`, { default: false });
      if (!proceed) return;
    }

    await whileWaiting("Revoking...", cloud.revokeApiKey(key.id));

    this.log("");
    this.log(`  ${chalk.green("Revoked")} ${key.name}`);
    if (isCurrent) this.log(chalk.dim("  Sign in again with: capuchoo auth login"));
    this.log("");
  }
}
