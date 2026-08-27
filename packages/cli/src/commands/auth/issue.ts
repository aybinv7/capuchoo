import { APP_ROLE_ORDER, describeCap, type AppRole } from "@capuchoo/core";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { hostname } from "node:os";
import { BaseCommand } from "../../base-command.js";
import { whileWaiting } from "../../cli/prompts.js";
import { requireCloud } from "../../cli/team.js";
import { readProjectConfig } from "../../utils/config.js";

export default class AuthIssue extends BaseCommand {
  static override description = "Create an API key, optionally limited to one app and one role";

  static override examples = [
    "<%= config.bin %> auth issue --name ci --role developer --this-app",
    "<%= config.bin %> auth issue --name readonly --role viewer",
  ];

  static override flags = {
    name: Flags.string({ description: "Label shown in capuchoo auth keys" }),
    role: Flags.string({
      description: `Ceiling on what the key may do: ${APP_ROLE_ORDER.join(", ")}`,
      options: [...APP_ROLE_ORDER],
    }),
    "this-app": Flags.boolean({
      default: false,
      description: "Restrict the key to the app this directory is linked to",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthIssue);
    const cloud = requireCloud(this);

    let appId: string | undefined;
    if (flags["this-app"]) {
      const project = readProjectConfig(process.cwd());
      if (!project) {
        this.error("--this-app needs a linked directory. Run capuchoo init, or drop the flag.");
      }
      appId = project.cloudAppId;
    }

    const name = flags.name?.trim() || `capuchoo-cli ${hostname()}`;
    const role = flags.role as AppRole | undefined;

    const { key } = await whileWaiting("Creating...", cloud.createApiKey({ name, appId, role }));

    this.log("");
    this.log(`  ${chalk.bold(name)}`);
    this.log(`    scope   ${appId ? chalk.yellow("this app only") : chalk.dim("all apps")}`);
    this.log(
      `    role    ${role ? chalk.yellow(describeCap(role)) : chalk.dim(describeCap(null))}`,
    );
    this.log("");
    // Shown once, because only its hash is stored.
    this.log(`  ${key}`);
    this.log("");
    this.log(chalk.yellow("  Copy it now - it is not stored and cannot be shown again."));
    this.log("");
  }
}
