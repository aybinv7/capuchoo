import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { membershipRows } from "../../cli/members.js";
import { whileWaiting } from "../../cli/prompts.js";
import { requireLinkedApp } from "../../cli/team.js";

export default class AppRoles extends BaseCommand {
  static override description = "Show who can do what on this app";

  static override examples = ["<%= config.bin %> app roles"];

  async run(): Promise<void> {
    const { cloud, project } = requireLinkedApp(this);

    const members = await whileWaiting(
      "Reading permissions...",
      cloud.appPermissions(project.cloudAppId),
    );

    this.log("");
    this.log(`  ${chalk.bold(project.appName)} ${chalk.dim(`(${project.appId})`)}`);
    this.log("");

    if (members.length === 0) {
      this.log(chalk.dim("  No direct grants. Organisation owners and admins still have access."));
      this.log("");
      return;
    }

    const width = Math.max(...membershipRows(members).map((row) => row.email.length));
    for (const row of membershipRows(members)) {
      const canPublish = row.role === "admin" || row.role === "developer";
      this.log(
        `  ${row.email.padEnd(width)}  ${canPublish ? chalk.green(row.role) : chalk.dim(row.role)}`,
      );
    }

    this.log("");
    this.log(chalk.dim("  Green roles may publish. Grant with: capuchoo app grant <email> <role>"));
    this.log("");
  }
}
