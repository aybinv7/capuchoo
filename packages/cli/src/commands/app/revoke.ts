import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { resolveByEmail } from "../../cli/members.js";
import { confirm, isInteractive, whileWaiting } from "../../cli/prompts.js";
import { requireLinkedApp } from "../../cli/team.js";

export default class AppRevoke extends BaseCommand {
  static override description = "Remove someone's role on this app";

  static override examples = ["<%= config.bin %> app revoke dev@company.com"];

  static override args = {
    email: Args.string({ description: "Account to revoke", required: true }),
  };

  static override flags = {
    yes: Flags.boolean({ char: "y", default: false, description: "Skip the confirmation" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AppRevoke);
    const { cloud, project } = requireLinkedApp(this);

    const members = await whileWaiting(
      "Reading permissions...",
      cloud.appPermissions(project.cloudAppId),
    );

    const found = resolveByEmail(members, args.email);
    if (!found.ok) this.error(found.problem!);

    if (!flags.yes) {
      if (!isInteractive()) {
        this.error(`Refusing to revoke ${args.email} unattended. Pass --yes.`);
      }
      const proceed = await confirm(`Revoke ${args.email} on ${project.appName}?`, {
        default: false,
      });
      if (!proceed) return;
    }

    await whileWaiting("Revoking...", cloud.revokeAppRole(project.cloudAppId, found.userId!));

    this.log("");
    this.log(`  ${chalk.green("Revoked")} ${args.email}`);
    this.log(
      chalk.dim("  Organisation owners and admins keep access - remove them from the org instead."),
    );
    this.log("");
  }
}
