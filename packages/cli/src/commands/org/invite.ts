import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "../../base-command.js";
import { selectOne, whileWaiting } from "../../cli/prompts.js";
import { ORG_ROLES, requireCloud } from "../../cli/team.js";
import type { OrgRole } from "../../services/cloud.js";

export default class OrgInvite extends BaseCommand {
  static override description = "Add an existing account to an organization";

  static override examples = ["<%= config.bin %> org invite dev@company.com member"];

  static override args = {
    email: Args.string({ description: "Account to add", required: true }),
    role: Args.string({
      description: `One of ${ORG_ROLES.join(", ")}`,
      required: true,
      options: [...ORG_ROLES],
    }),
  };

  static override flags = {
    org: Flags.string({ description: "Organization by name or id" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(OrgInvite);
    const cloud = requireCloud(this);

    const organizations = await whileWaiting("Reading organizations...", cloud.organizations());
    const admin = organizations.filter((org) => org.role === "owner" || org.role === "admin");

    if (admin.length === 0) {
      this.error("Only an owner or admin can add members, and this account is neither.");
    }

    const wanted = flags.org?.trim().toLowerCase();
    const organization = wanted
      ? admin.find((org) => org.name.toLowerCase() === wanted || org.id.toLowerCase() === wanted)
      : admin.length === 1
        ? admin[0]
        : await selectOne(
            "Which organization?",
            admin.map((org) => ({ value: org, label: org.name, hint: org.role })),
            "--org",
          );

    if (!organization) {
      this.error(
        `No organization called "${flags.org}" that this account administers. ` +
          `Available: ${admin.map((org) => org.name).join(", ")}.`,
      );
    }

    // The server resolves the address; there is no signup here, so the account
    // has to exist already.
    await whileWaiting(
      "Adding...",
      cloud.addOrgMember(organization.id, args.email.trim(), args.role as OrgRole),
    );

    this.log("");
    this.log(
      `  ${chalk.green("Added")} ${args.email} to ${organization.name} as ${chalk.bold(args.role)}`,
    );
    if (args.role === "owner" || args.role === "admin") {
      this.log(chalk.yellow("  That is admin rights on every app in the organization."));
    } else {
      this.log(chalk.dim("  Grant app access with: capuchoo app grant <email> <role>"));
    }
    this.log("");
  }
}
