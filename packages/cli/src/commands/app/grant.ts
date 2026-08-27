import { Args } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { whileWaiting } from "../../cli/prompts.js";
import { APP_ROLES, requireLinkedApp } from "../../cli/team.js";
import type { AppRole } from "../../services/cloud.js";

export default class AppGrant extends BaseCommand {
  static override description = "Give someone a role on this app";

  static override examples = [
    "<%= config.bin %> app grant dev@company.com developer",
    "<%= config.bin %> app grant qa@company.com tester",
  ];

  static override args = {
    email: Args.string({ description: "Account to grant", required: true }),
    role: Args.string({
      description: `One of ${APP_ROLES.join(", ")}`,
      required: true,
      options: [...APP_ROLES],
    }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(AppGrant);
    const { cloud, project } = requireLinkedApp(this);

    await whileWaiting(
      "Granting...",
      cloud.grantAppRole(project.cloudAppId, args.email.trim(), args.role as AppRole),
    );

    const publishes = args.role === "admin" || args.role === "developer";

    this.log("");
    this.log(`  ${chalk.green("Granted")} ${args.email} is now ${chalk.bold(args.role)}`);
    this.log(
      chalk.dim(publishes ? "  They can publish releases." : "  They cannot publish releases."),
    );
    this.log("");
  }
}
